package expo.modules.fcpbkdf2

import android.os.Build
import android.os.Looper
import android.os.SystemClock
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withContext
import org.json.JSONObject

class FcNativePbkdf2Module : Module() {
  companion object {
    // Shared across module instances. Never release while native computation is still running.
    private val running = AtomicBoolean(false)
  }

  override fun definition() = ModuleDefinition {
    Name("FcNativePbkdf2")

    Function("isPinDerivationAvailable") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.O }

    // Credential serialization stays in the shared JS service. Fixed work factor and output size.
    AsyncFunction("derivePin") Coroutine { pin: String, saltHex: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        throw CodedException("ERR_NATIVE_PIN_UNAVAILABLE", "Android API 26 or later required. Access remains locked.", null)
      }
      if (!running.compareAndSet(false, true)) {
        throw CodedException("ERR_NATIVE_PIN_BUSY", "Native derivation is already running.", null)
      }
      try {
        withContext(Dispatchers.Default) {
          check(Looper.myLooper() != Looper.getMainLooper())
          check(pin.matches(Regex("[0-9]{6}")) && saltHex.matches(Regex("[0-9a-f]{32}")))
          val password = pin.toCharArray()
          val salt = decodeHex(saltHex)
          var derived: ByteArray? = null
          try {
            val output = deriveBytes(password, salt)
            derived = output
            output.joinToString("") { "%02x".format(it.toInt() and 0xff) }
          } finally {
            password.fill('\u0000')
            salt.fill(0)
            derived?.fill(0)
          }
        }
      } catch (cancelled: CancellationException) {
        throw cancelled
      } catch (_: Exception) {
        // Never return provider exceptions, PINs, salts or derived material in error details.
        throw CodedException("ERR_NATIVE_PIN_DERIVATION", "Native PIN derivation failed. Access remains locked.", null)
      } finally {
        running.set(false)
      }
    }

    // Test-only API: fixed public vectors, no arbitrary PIN/credential inputs or key outputs.
    AsyncFunction("runProof") Coroutine { vectorId: String ->
      check(BuildConfig.DEBUG) { "Proof of concept unavailable in release builds." }
      check(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) { "Android API 26 or later required." }
      check(running.compareAndSet(false, true)) { "A native proof is already running." }
      try {
        withContext(Dispatchers.Default) {
          val offMainThread = Looper.myLooper() != Looper.getMainLooper()
          check(offMainThread) { "Background execution required." }
          val context = appContext.reactContext ?: error("Application context unavailable.")
          val text = context.assets.open("fc-pbkdf2-vectors.json").bufferedReader().use { it.readText() }
          val fixture = JSONObject(text)
          check(fixture.getInt("iterations") == 600000 && fixture.getInt("saltBytes") == 16 && fixture.getInt("verifierBytes") == 32) { "Invalid public vector parameters." }
          val vectors = fixture.getJSONArray("vectors")
          val vector = (0 until vectors.length()).map { vectors.getJSONObject(it) }
            .firstOrNull { it.getString("id") == vectorId } ?: error("Unknown public vector.")
          val password = vector.getString("password").toCharArray()
          check(password.size == 6 && password.all { it in '0'..'9' }) { "Invalid public input." }
          val salt = decodeHex(vector.getString("saltHex"))
          val expected = decodeHex(vector.getString("expectedHex"))
          check(salt.size == 16 && expected.size == 32) { "Invalid public vector lengths." }
          var actual: ByteArray? = null
          try {
            val started = SystemClock.elapsedRealtimeNanos()
            val derived = deriveBytes(password, salt)
            actual = derived
            val durationMs = (SystemClock.elapsedRealtimeNanos() - started) / 1_000_000.0
            mapOf("vectorId" to vectorId, "passed" to MessageDigest.isEqual(derived, expected),
              "derivationMs" to durationMs, "offMainThread" to offMainThread, "androidApi" to Build.VERSION.SDK_INT)
          } finally {
            password.fill('\u0000')
            actual?.fill(0)
            salt.fill(0)
            expected.fill(0)
          }
        }
      } finally {
        running.set(false)
      }
    }
  }

  // Called only inside Dispatchers.Default by authentication and the retained public proof.
  private fun deriveBytes(password: CharArray, salt: ByteArray): ByteArray {
    check(password.size == 6 && password.all { it in '0'..'9' } && salt.size == 16)
    val spec = PBEKeySpec(password, salt, 600000, 256)
    try {
      return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded.also {
        check(it.size == 32)
      }
    } finally {
      spec.clearPassword()
    }
  }

  private fun decodeHex(value: String): ByteArray {
    check(value.matches(Regex("[0-9a-f]+")) && value.length % 2 == 0) { "Invalid public hex." }
    return ByteArray(value.length / 2) { value.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
  }
}
