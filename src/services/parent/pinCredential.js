const ITERATIONS = 600000;
function createPinCredential(crypto) {
  const check = pin => { if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) throw new Error('Use exactly six digits.'); };
  function valid(record) {
    return Boolean(record && record.algorithm === 'PBKDF2-SHA256' && record.iterations === ITERATIONS &&
      /^[0-9a-f]{32}$/.test(record.salt) && /^[0-9a-f]{64}$/.test(record.verifier));
  }
  const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  async function derive(pin, salt) {
    if (!crypto?.subtle || !crypto?.getRandomValues) throw new Error('Secure local PIN setup requires Web Crypto on localhost or HTTPS.');
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, 256));
  }
  return {
    valid,
    async create(pin) {
      check(pin);
      if (!crypto?.getRandomValues) throw new Error('Secure local PIN setup is unavailable.');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      return { algorithm: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: hex(salt), verifier: hex(await derive(pin, salt)) };
    },
    async verify(pin, record) {
      check(pin);
      if (!valid(record)) throw new Error('Invalid PIN configuration. Local access is locked.');
      const actual = await derive(pin, Uint8Array.from(record.salt.match(/../g), byte => parseInt(byte, 16)));
      const expected = Uint8Array.from(record.verifier.match(/../g), byte => parseInt(byte, 16));
      let difference = 0;
      for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
      return difference === 0;
    },
  };
}
module.exports = { createPinCredential };
