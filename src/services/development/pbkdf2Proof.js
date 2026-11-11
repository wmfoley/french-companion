// This controller deliberately has no household, credential or persistence dependencies.
const vectorIds = ['digits', 'leading-zero'];
function createPbkdf2Proof({ development, platform, loadModule, now = Date.now }) {
  let running = false;
  function availableModule() {
    if (!development || platform !== 'android') return null;
    try { return loadModule(); } catch { return null; }
  }
  return {
    available: () => typeof availableModule()?.runProof === 'function',
    async run(vectorId) {
      if (running) throw new Error('A native proof is still running. Wait for completion before retrying.');
      if (!vectorIds.includes(vectorId)) throw new Error('Unknown public test vector.');
      const native = availableModule();
      if (typeof native?.runProof !== 'function') throw new Error('Native proof unavailable. Use French Companion Dev on Android 8 or later; Expo Go and web are unsupported.');
      running = true;
      const started = now();
      try {
        let result;
        try { result = await native.runProof(vectorId); }
        catch { throw new Error('Native proof failed. Confirm Android API 26+, a debug development build, and no concurrent native run.'); }
        if (result?.vectorId !== vectorId || typeof result.passed !== 'boolean' || result.offMainThread !== true ||
          !Number.isInteger(result.androidApi) || result.androidApi < 26 || !Number.isFinite(result.derivationMs) || result.derivationMs < 0) {
          throw new Error('Native proof returned an invalid result. Do not integrate it with household authentication.');
        }
        // Whitelist output: never forward unknown native properties or raw exceptions to UI/logs.
        return { vectorId, passed: result.passed, derivationMs: result.derivationMs,
          offMainThread: true, androidApi: result.androidApi, roundTripMs: Math.max(0, now() - started) };
      } finally { running = false; }
    },
  };
}
module.exports = { createPbkdf2Proof, vectorIds };
