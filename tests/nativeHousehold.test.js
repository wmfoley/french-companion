const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { webcrypto } = require('node:crypto');
const { createSqliteStore } = require('../src/services/storage/sqliteStore');
const { createHouseholdService } = require('../src/services/householdService');
const { createPinCredential } = require('../src/services/parent/pinCredential');
const { createDevelopmentSample } = require('../src/content/developmentSample');
const { generateVocabularyQuestions } = require('../src/core/exercises/vocabularyMultipleChoice');
const { createSetupDiagnostics } = require('../src/services/parent/setupDiagnostics');

function nativeHarness({ randomId = async () => 'credential-id', beforeSecureWrite = async () => {}, suppliedCredential } = {}) {
  const db = new DatabaseSync(':memory:');
  let secret = null;
  let failSecure = false;
  let failReady = false;
  let failWrite = false;
  let time = 1000;
  const credential = suppliedCredential || { valid: record => record?.test === 'verifier', create: async () => ({ test: 'verifier' }), verify: async pin => pin === '123456' };
  const tx = {
    async getFirstAsync(sql, ...params) { return db.prepare(sql).get(...params); },
    async runAsync(sql, ...params) {
      if (failWrite || (failReady && sql.includes("phase = 'ready'"))) throw new Error('Injected interrupted write');
      return db.prepare(sql).run(...params);
    },
  };
  let queue = Promise.resolve();
  const sqlite = {
    async execAsync(sql) { db.exec(sql); },
    withExclusiveTransactionAsync(task) {
      const result = queue.then(async () => {
        db.exec('BEGIN IMMEDIATE');
        try { await task(tx); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  const secureStore = { async getItemAsync() { return secret; }, async setItemAsync(key, value) { if (failSecure) throw Error('Unavailable'); await beforeSecureWrite(); secret = value; } };
  const makeStore = () => createSqliteStore({ openDatabase: async () => sqlite, secureStore, randomId, validCredential: credential.valid });
  const store = makeStore();
  const makeService = (development = true) => createHouseholdService({ store: makeStore(), credential, now: () => time, development, sampleProvider: createDevelopmentSample });
  return { db, store, makeStore, makeService, credential, advance: ms => { time += ms; },
    secret: () => secret, setSecret: value => { secret = value; }, failSecure: () => { failSecure = true; },
    failReady: value => { failReady = value; }, failWrite: value => { failWrite = value; } };
}

test('parent corrections and review use SQLite rollback, revision CAS and durable adapter recreation', async () => {
  const h = nativeHarness(); const service = h.makeService();
  try {
    await service.setup('123456', '123456'); const token = await service.unlock('123456');
    const id = await service.loadDevelopmentSample(token);
    const original = await service.readParentAssignment(token, { assignmentId: id });
    const request = { assignmentId: id, expectedWriteRevision: 1, corrections: [{ fieldPath: '/vocabulary/0/term', text: 'un dirigeant corrigé', correctionExplanation: 'Parent correction.' }] };
    h.failWrite(true);
    await assert.rejects(service.saveParentCorrections(token, request), { code: 'persistence_failed' });
    h.failWrite(false);
    assert.deepEqual((await service.readParentAssignment(token, { assignmentId: id })).document, original.document);
    await service.saveParentCorrections(token, request);
    await assert.rejects(service.saveParentCorrections(token, request), { code: 'stale_document' });
    await service.markAllReviewed(token, { assignmentId: id, expectedWriteRevision: 2, confirmReviewDeclaration: true });
    await service.loadDevelopmentSample(token);
    const recreated = h.makeService(); const current = await recreated.unlock('123456');
    const fresh = await recreated.readParentAssignment(current, { assignmentId: id });
    assert.equal(fresh.writeRevision, 3); assert.equal(fresh.document.contentRevision, 2);
    assert.equal(fresh.review.reviewedFieldPaths.length, 20); assert.equal(fresh.document.approval, null);
    assert.deepEqual(fresh.document.assignment.sources, original.document.assignment.sources);
    assert.equal((await recreated.readPractice(id)).eligibility.eligible, false);
    await recreated.approveReviewedAssignment(current, { assignmentId: id, expectedWriteRevision: 3, confirmAcceptance: true, confirmNoKnownGaps: true });
    const approved = (await h.makeStore().read()).assignments[0];
    assert.equal(approved.writeRevision, 4); assert.equal(approved.contentRevision, 2); assert.equal(approved.approval.method, 'reviewed');
    assert.equal((await recreated.readPractice(id)).eligibility.eligible, true);
    h.failWrite(true);
    await assert.rejects(recreated.approveWithoutDetailedReview(current, { assignmentId: id, expectedWriteRevision: 4, acknowledgeRisk: true, confirmAcceptance: true }), { code: 'persistence_failed' });
    h.failWrite(false); assert.deepEqual((await h.makeStore().read()).assignments[0], approved);
    await recreated.saveParentCorrections(current, { ...request, expectedWriteRevision: 4,
      corrections: [{ ...request.corrections[0], correctionExplanation: 'Updated explanation only.' }] });
    const restarted = h.makeService(); const nextToken = await restarted.unlock('123456');
    const selective = await restarted.readParentAssignment(nextToken, { assignmentId: id });
    assert.equal(selective.review.reviewedFieldPaths.length, 19); assert.equal(selective.document.approval, null);
    assert.equal(selective.writeRevision, 5); assert.equal(selective.document.contentRevision, 3);
    assert.deepEqual(selective.document.assignment.vocabulary[0].definitionFr, approved.assignment.vocabulary[0].definitionFr);
    assert.equal((await restarted.readPractice(id)).eligibility.eligible, false);
  } finally { h.db.close(); }
});

test('leaving after mutation but before first household write rolls back initialization', async () => {
  let release; let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const h = nativeHarness({ randomId: () => { entered(); return new Promise(resolve => { release = resolve; }); } });
  const service = h.makeService(); const setup = service.setup('123456', '123456');
  await ready; service.lock();
  await assert.rejects(service.setup('123456', '123456'), /still running/);
  release('credential-id'); await assert.rejects(setup, /cancelled/);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM installation').get().n, 0);
  assert.equal(h.secret(), null); h.db.close();
});

test('leaving during SecureStore persistence completes strict binding, keeps guard, and never unlocks', async () => {
  let release; let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const h = nativeHarness({ beforeSecureWrite: () => { entered(); return new Promise(resolve => { release = resolve; }); } });
  const service = h.makeService(); const setup = service.setup('123456', '123456');
  await ready; service.lock();
  assert.equal(h.db.prepare('SELECT phase FROM installation').get().phase, 'pending');
  await assert.rejects(service.setup('123456', '123456'), /still running/);
  release(); await setup;
  assert.equal(h.db.prepare('SELECT phase FROM installation').get().phase, 'ready');
  assert.equal((await h.store.read()).household.policy.practiceMode, 'require_parent_approval');
  await assert.rejects(service.getParentPolicy({}), /locked/);
  await assert.rejects(service.setup('123456', '123456'), /already configured/);
  h.db.close();
});

test('native diagnostic stages include queued access, transaction completion, SecureStore and binding', async () => {
  const h = nativeHarness();
  const diagnostics = createSetupDiagnostics({ enabled: true, schedule: () => 0, cancel() {} });
  const service = createHouseholdService({ store: h.store, credential: h.credential, setupDiagnostics: diagnostics });
  await service.setup('123456', '123456');
  const complete = diagnostics.snapshot().filter(event => event.event === 'complete').map(event => event.stage);
  assert.deepEqual(complete, ['storage_queue', 'sqlite_init', 'secure_read', 'sqlite_transaction', 'secure_read', 'secure_write', 'secure_read', 'sqlite_transaction', 'binding', 'setup']);
  assert.ok(!JSON.stringify(diagnostics.snapshot()).includes('verifier'));
  h.db.close();
});

test('native storage persists shared envelope, with verifier only in SecureStore, and defaults strict', async () => {
  const h = nativeHarness(); const service = h.makeService();
  await service.setup('123456', '123456');
  assert.ok(h.secret().includes('verifier'));
  assert.ok(!h.db.prepare('SELECT payload FROM installation').get().payload.includes('verifier'));
  const record = await h.store.read();
  assert.equal(record.household.credential.test, 'verifier');
  assert.equal(record.household.policy.practiceMode, 'require_parent_approval');
  assert.equal((await h.makeService().status()).needsSetup, false);
  const token = await service.unlock('123456');
  await assert.rejects(h.makeService().getParentPolicy(token), /locked/);
  h.db.close();
});

test('native transaction rollback and failed save cannot persist permissive policy', async () => {
  const h = nativeHarness(); const service = h.makeService();
  await service.setup('123456', '123456'); const token = await service.unlock('123456');
  h.failWrite(true);
  await assert.rejects(service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true }));
  h.failWrite(false);
  assert.equal((await h.store.read()).household.policy.practiceMode, 'require_parent_approval');
  await assert.rejects(h.store.update(state => { state.household.policy.practiceMode = 'allow_independent_practice'; throw Error('abort'); }));
  assert.equal((await h.store.read()).household.policy.practiceMode, 'require_parent_approval');
  h.db.close();
});

test('corrupted and unsupported native policy records do not enable independent practice', async () => {
  const h = nativeHarness(); const service = h.makeService();
  await service.setup('123456', '123456'); const token = await service.unlock('123456');
  const id = await service.loadDevelopmentSample(token);
  for (const policy of [null, { policyVersion: 2, revision: 1, practiceMode: 'allow_independent_practice', riskAcknowledgementVersion: 1 },
    { policyVersion: 1, revision: 1, practiceMode: 'allow_independent_practice' }]) {
    await h.store.update(state => { state.household.policy = policy; return state; });
    assert.equal((await service.readPractice(id)).eligibility.eligible, false);
  }
  h.db.close();
});

test('interruption after pending marker but before SecureStore stays locked without resetting data', async () => {
  const h = nativeHarness(); h.failSecure();
  await assert.rejects(h.makeService().setup('123456', '123456'), /credentials/);
  assert.equal(h.db.prepare('SELECT phase FROM installation').get().phase, 'pending');
  await assert.rejects(h.makeStore().read(), /credentials/);
  await assert.rejects(h.makeService().status(), /credentials/);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS count FROM installation').get().count, 1);
  h.db.close();
});

test('interruption after SecureStore write resumes only matching initial strict setup', async () => {
  const h = nativeHarness(); h.failReady(true);
  await assert.rejects(h.makeService().setup('123456', '123456'));
  assert.ok(h.secret());
  h.failReady(false);
  const state = await h.makeStore().read();
  assert.equal(state.household.policy.practiceMode, 'require_parent_approval');
  assert.deepEqual(state.assignments, []);
  assert.equal(h.db.prepare('SELECT phase FROM installation').get().phase, 'ready');
  await assert.rejects(h.makeService().getParentPolicy({}), /locked/);
  h.db.close();
});

test('credential loss, mismatch, corruption and orphan credentials all fail closed', async () => {
  const h = nativeHarness(); await h.makeService().setup('123456', '123456');
  const saved = h.secret();
  for (const invalid of [null, 'invalid-json', JSON.stringify({ id: 'different', record: { test: 'verifier' } })]) {
    h.setSecret(invalid); await assert.rejects(h.makeStore().read(), /credentials/);
  }
  h.setSecret(saved);
  h.db.exec('DELETE FROM installation');
  await assert.rejects(h.makeStore().read(), /credentials/);
  h.db.close();
});

test('native service protects policy/sample commands, rejects stale writes, and revokes eligibility', async () => {
  const h = nativeHarness(); const service = h.makeService();
  await service.setup('123456', '123456');
  await assert.rejects(service.loadDevelopmentSample({}), /locked/);
  const token = await service.unlock('123456');
  const id = await service.loadDevelopmentSample(token);
  await service.loadDevelopmentSample(token);
  assert.equal((await h.store.read()).assignments.length, 1);
  assert.equal((await service.readPractice(id)).eligibility.eligible, false);
  await service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  const allowed = await service.readPractice(id);
  assert.equal(allowed.document.assignment.reviewStatus, 'pending_review');
  assert.equal(allowed.document.approval, null);
  assert.equal(allowed.eligibility.eligible, true);
  assert.equal(generateVocabularyQuestions(allowed.document.assignment, { purpose: 'development_sample', development: true, householdPolicy: allowed.policy }).questions.length, 5);
  assert.equal(generateVocabularyQuestions(allowed.document.assignment, { purpose: 'development_sample', development: false, householdPolicy: allowed.policy }).questions.length, 0);
  await assert.rejects(service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: 'require_parent_approval' }), /another tab/);
  await service.setPracticePolicy(token, { expectedRevision: 2, practiceMode: 'require_parent_approval' });
  assert.equal((await service.readPractice(id)).eligibility.eligible, false);
  const production = h.makeService(false);
  assert.deepEqual(await production.listPracticeAssignments(), []);
  const productionToken = await production.unlock('123456');
  await assert.rejects(production.loadDevelopmentSample(productionToken), /production/);
  h.db.close();
});

test('inactivity refreshes only explicit authenticated activity; polls/background lock do not', async () => {
  const h = nativeHarness(); const service = h.makeService();
  await service.setup('123456', '123456'); let token = await service.unlock('123456');
  h.advance(240000); await service.getParentPolicy(token); service.noteParentActivity(token);
  h.advance(240000); await service.getParentPolicy(token);
  h.advance(60000); await assert.rejects(service.getParentPolicy(token), /locked/);
  token = await service.unlock('123456'); service.lock();
  assert.throws(() => service.noteParentActivity(token), /locked/);
  await assert.rejects(service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true }), /locked/);
  h.db.close();
});

test('concurrent PIN verification is rejected and lock cancels verification in flight', async () => {
  const h = nativeHarness(); let release;
  const credential = { ...h.credential, verify: () => new Promise(resolve => { release = resolve; }) };
  const service = createHouseholdService({ store: h.store, credential });
  await service.setup('123456', '123456');
  const first = service.unlock('123456');
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  await assert.rejects(service.unlock('123456'), /already running/);
  service.lock(); release(true); await assert.rejects(first, /cancelled/);
  h.db.close();
});

test('native adapter contract with Node stand-in matches Web Crypto; not Android execution', async () => {
  const { createNativePinEngine } = await import('../src/services/parent/nativePinEngine.js');
  const { pbkdf2Sync } = require('node:crypto');
  const { Buffer } = require('node:buffer');
  const engine = createNativePinEngine(async size => webcrypto.getRandomValues(new Uint8Array(size)), () => ({
    isPinDerivationAvailable: () => true,
    derivePin: async (pin, saltHex) => pbkdf2Sync(pin, Buffer.from(saltHex, 'hex'), 600000, 32, 'sha256').toString('hex'),
  }));
  const native = createPinCredential(null, engine);
  const web = createPinCredential(webcrypto);
  const record = await web.create('123456');
  assert.equal(await native.verify('123456', record), true);
  assert.equal(await native.verify('654321', record), false);
  const nativeRecord = await native.create('123456');
  assert.equal(await web.verify('123456', nativeRecord), true);
});

test('real credential adapter persists compatible native envelopes and unlocks after recreation', async () => {
  const { createNativePinEngine } = require('../src/services/parent/nativePinEngine');
  const { pbkdf2Sync } = require('node:crypto');
  const { Buffer } = require('node:buffer');
  const engine = createNativePinEngine(async size => webcrypto.getRandomValues(new Uint8Array(size)), () => ({
    isPinDerivationAvailable: () => true,
    derivePin: async (pin, saltHex) => pbkdf2Sync(pin, Buffer.from(saltHex, 'hex'), 600000, 32, 'sha256').toString('hex'),
  }));
  const credential = { ...createPinCredential(null, engine), assertAvailable: engine.assertAvailable };
  const h = nativeHarness({ suppliedCredential: credential }); const service = h.makeService();
  await service.setup('000001', '000001');
  const saved = (await h.store.read()).household.credential;
  assert.equal(await createPinCredential(webcrypto).verify('000001', saved), true);
  assert.ok(!h.db.prepare('SELECT payload FROM installation').get().payload.includes(saved.verifier));
  const token = await h.makeService().unlock('000001');
  await assert.rejects(service.getParentPolicy(token), /locked/);
  const recreated = h.makeService(); await assert.rejects(recreated.unlock('000002'), /not recognised/);
  h.advance(1001); const unlocked = await recreated.unlock('000001');
  assert.equal((await recreated.getParentPolicy(unlocked)).practiceMode, 'require_parent_approval');
  h.db.close();
});
