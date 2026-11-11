const UNAVAILABLE = 'Native household PIN authentication is unavailable. Use an updated French Companion Dev APK on Android 8 or later. Expo Go and the earlier proof-only APK cannot authenticate. Household data has been kept; access remains locked.';
function createNativePinEngine(randomBytes, loadModule) {
  let running = false;
  function requireModule() {
    let native;
    try {
      native = loadModule?.();
      if (typeof native?.derivePin !== 'function' || typeof native?.isPinDerivationAvailable !== 'function' ||
        native.isPinDerivationAvailable() !== true) native = null;
    } catch { native = null; }
    if (!native) throw new Error(UNAVAILABLE);
    return native;
  }
  return {
    assertAvailable: () => { requireModule(); },
    randomBytes: async size => { requireModule(); return randomBytes(size); },
    async derive(pin, salt, iterations) {
      if (typeof pin !== 'string' || !/^[0-9]{6}$/.test(pin) || !(salt instanceof Uint8Array) || salt.length !== 16 || iterations !== 600000) {
        throw new Error('Invalid native PIN derivation parameters. Access remains locked.');
      }
      const native = requireModule();
      if (running) throw new Error('Native PIN derivation is already running. Please wait.');
      running = true;
      try {
        const saltHex = Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join('');
        let result;
        try { result = await native.derivePin(pin, saltHex); }
        catch { throw new Error('Native PIN derivation failed. Household data has been kept; access remains locked.'); }
        if (typeof result !== 'string' || !/^[0-9a-f]{64}$/.test(result)) throw new Error('Invalid native PIN result. Access remains locked.');
        return Uint8Array.from(result.match(/../g), byte => parseInt(byte, 16));
      } finally { running = false; }
    },
  };
}
module.exports = { createNativePinEngine };
