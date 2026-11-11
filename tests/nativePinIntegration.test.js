const test = require('node:test');
const assert = require('node:assert/strict');
const { pbkdf2Sync, webcrypto } = require('node:crypto');
const { Buffer } = require('node:buffer');
const { createNativePinEngine } = require('../src/services/parent/nativePinEngine');
const { createPinCredential } = require('../src/services/parent/pinCredential');
const { createHouseholdService } = require('../src/services/householdService');
const vectors = require('../modules/fc-native-pbkdf2/android/src/main/assets/fc-pbkdf2-vectors.json');
const standIn = {
  isPinDerivationAvailable: () => true,
  derivePin: async (pin, saltHex) => pbkdf2Sync(pin, Buffer.from(saltHex, 'hex'), 600000, 32, 'sha256').toString('hex'),
};
const randomBytes = async size => webcrypto.getRandomValues(new Uint8Array(size));

test('missing, old, unsupported and throwing native capabilities fail closed without raw error disclosure', async () => {
  for (const load of [() => null, () => ({ runProof() {} }), () => ({ ...standIn, isPinDerivationAvailable: () => false }),
    () => { throw Error('SECRET'); }, () => ({ ...standIn, isPinDerivationAvailable: () => { throw Error('SECRET'); } })]) {
    let randomCalled = false;
    const engine = createNativePinEngine(async () => { randomCalled = true; }, load);
    assert.throws(engine.assertAvailable, error => /unavailable/.test(error.message) && !error.message.includes('SECRET'));
    await assert.rejects(engine.randomBytes(16), /unavailable/); assert.equal(randomCalled, false);
    await assert.rejects(engine.derive('123456', new Uint8Array(16), 600000), /unavailable/);
  }
});

test('fixed parameters, public vectors and exact existing credential serialization are preserved', async () => {
  const engine = createNativePinEngine(randomBytes, () => standIn);
  const credential = createPinCredential(null, engine);
  for (const vector of vectors.vectors) {
    const salt = Uint8Array.from(Buffer.from(vector.saltHex, 'hex'));
    assert.equal(Buffer.from(await engine.derive(vector.password, salt, 600000)).toString('hex'), vector.expectedHex);
    const saved = { algorithm: 'PBKDF2-SHA256', iterations: 600000, salt: vector.saltHex, verifier: vector.expectedHex };
    assert.equal(await credential.verify(vector.password, saved), true);
    assert.equal(await credential.verify('999999', saved), false);
  }
  const saved = await credential.create('000001');
  assert.deepEqual(Object.keys(saved), ['algorithm', 'iterations', 'salt', 'verifier']);
  assert.match(saved.salt, /^[0-9a-f]{32}$/); assert.match(saved.verifier, /^[0-9a-f]{64}$/);
  assert.equal(await createPinCredential(webcrypto).verify('000001', saved), true);
  for (const args of [['１２３４５６', new Uint8Array(16), 600000], ['123456', new Uint8Array(15), 600000], ['123456', new Uint8Array(16), 599999]]) {
    await assert.rejects(engine.derive(...args), /Invalid/);
  }
});

test('native failures and malformed output reject; no empty or short result can verify a PIN', async () => {
  let output = ''; let fail = false;
  const engine = createNativePinEngine(randomBytes, () => ({ ...standIn, derivePin: async () => { if (fail) throw Error('PIN-SALT-SECRET'); return output; } }));
  for (const invalid of ['', '00', 'ff'.repeat(33), 'FF'.repeat(32), null, new Uint8Array(32)]) {
    output = invalid; await assert.rejects(engine.derive('123456', new Uint8Array(16), 600000), /Invalid native PIN result/);
  }
  fail = true; await assert.rejects(engine.derive('123456', new Uint8Array(16), 600000), error => !error.message.includes('SECRET'));
  fail = false; output = '00'.repeat(32); assert.equal((await engine.derive('123456', new Uint8Array(16), 600000)).length, 32);
});

test('availability failure prevents all storage access, setup and new parent authorization', async () => {
  const engine = createNativePinEngine(randomBytes, () => null);
  const credential = { ...createPinCredential(null, engine), assertAvailable: engine.assertAvailable };
  const service = createHouseholdService({ credential, store: { read: () => assert.fail('storage read'), update: () => assert.fail('storage write') } });
  for (const operation of [() => service.status(), () => service.setup('123456', '123456'), () => service.unlock('123456'), () => service.listPracticeAssignments()]) {
    await assert.rejects(operation(), /unavailable/);
  }
});

test('deferred native work holds guards after navigation; late setup cannot persist or unlock', async () => {
  let finish; let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const engine = createNativePinEngine(randomBytes, () => ({ ...standIn, derivePin: () => { entered(); return new Promise(resolve => { finish = resolve; }); } }));
  const credential = { ...createPinCredential(null, engine), assertAvailable: engine.assertAvailable };
  const service = createHouseholdService({ credential, store: { update: () => assert.fail('cancelled setup must not write') } });
  const setup = service.setup('123456', '123456'); await ready;
  service.lock();
  await assert.rejects(service.setup('123456', '123456'), /still running/);
  await assert.rejects(engine.derive('123456', new Uint8Array(16), 600000), /already running/);
  finish('00'.repeat(32)); await assert.rejects(setup, /cancelled/);
  await assert.rejects(service.getParentPolicy({}), /locked/);
});

test('native unlock rejects concurrency and ignores late success after background lock', async () => {
  const saved = { algorithm: 'PBKDF2-SHA256', iterations: 600000, salt: '00'.repeat(16), verifier: '00'.repeat(32) };
  let state = { storageVersion: 1, assignments: [], household: { credential: saved, failures: 0, blockedUntil: 0,
    policy: { policyVersion: 1, revision: 1, practiceMode: 'require_parent_approval' } } };
  let finish; let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const engine = createNativePinEngine(randomBytes, () => ({ ...standIn, derivePin: () => { entered(); return new Promise(resolve => { finish = resolve; }); } }));
  const credential = { ...createPinCredential(null, engine), assertAvailable: engine.assertAvailable };
  const service = createHouseholdService({ credential, store: {
    read: async () => structuredClone(state), update: async mutate => { state = mutate(structuredClone(state)); return structuredClone(state); },
  } });
  const unlock = service.unlock('123456'); await ready;
  await assert.rejects(service.unlock('123456'), /already running/);
  service.lock(); finish('00'.repeat(32)); await assert.rejects(unlock, /cancelled/);
  await assert.rejects(service.getParentPolicy({}), /locked/);
  assert.equal(state.household.policy.practiceMode, 'require_parent_approval');
  assert.equal(state.household.failures, 1);
});

test('native availability loss revokes an existing capability even if the module later recovers', async () => {
  let available = true;
  const vector = vectors.vectors[0];
  let state = { storageVersion: 1, assignments: [], household: { failures: 0, blockedUntil: 0,
    credential: { algorithm: 'PBKDF2-SHA256', iterations: 600000, salt: vector.saltHex, verifier: vector.expectedHex },
    policy: { policyVersion: 1, revision: 1, practiceMode: 'require_parent_approval' } } };
  const engine = createNativePinEngine(randomBytes, () => available ? standIn : null);
  const service = createHouseholdService({ credential: { ...createPinCredential(null, engine), assertAvailable: engine.assertAvailable },
    store: { read: async () => structuredClone(state), update: async mutate => { state = mutate(structuredClone(state)); return structuredClone(state); } } });
  const token = await service.unlock(vector.password);
  available = false; await assert.rejects(service.status(), /unavailable/);
  available = true; await assert.rejects(service.getParentPolicy(token), /locked/);
});
