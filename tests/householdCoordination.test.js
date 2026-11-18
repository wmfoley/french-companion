const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createSqliteStore } = require('../src/services/storage/sqliteStore');
const { createHouseholdService } = require('../src/services/householdService');
const { createDevelopmentSample } = require('../src/content/developmentSample');
const { fingerprint } = require('../src/services/storage/householdReferenceReceipts');
function harness(t, onDisk = false) {
  const directory = onDisk ? fs.mkdtempSync(path.join(os.tmpdir(), 'fc-household-receipts-')) : null;
  const file = directory ? path.join(directory, 'isolated.db') : ':memory:';
  let db = new DatabaseSync(file); let secret = null; let clock = 100; let queue = Promise.resolve();
  let onRead = () => {}; let onWrite = async () => {}; let fault = () => false;
  const tx = {
    async execAsync(sql) { if (fault(sql)) throw Error('Injected schema failure'); db.exec(sql); },
    async getFirstAsync(sql, ...args) { return db.prepare(sql).get(...args); },
    async getAllAsync(sql, ...args) { const result = db.prepare(sql).all(...args); onRead(sql); return result; },
    async runAsync(sql, ...args) {
      if (fault(sql)) throw Error('Injected write failure'); const result = db.prepare(sql).run(...args); await onWrite(sql); return result;
    },
  };
  const native = { async execAsync(sql) { db.exec(sql); }, withExclusiveTransactionAsync(fn) {
    const result = queue.then(async () => { db.exec('BEGIN IMMEDIATE'); try { await fn(tx); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } });
    queue = result.catch(() => {}); return result;
  } };
  const credential = { valid: r => r?.fixture === 'valid', create: async () => ({ fixture: 'valid' }), verify: async pin => pin === '123456' };
  let access; let bridge;
  function make() {
    const store = createSqliteStore({ openDatabase: async () => native, secureStore: { getItemAsync: async () => secret, setItemAsync: async (key, value) => { secret = value; } },
      randomId: async () => 'installation-test', validCredential: credential.valid, coordinationNow: () => clock, onCoordinationReady: a => { access = a; } });
    const service = createHouseholdService({ store, credential, sessionNow: () => clock, now: () => clock, development: true, sampleProvider: createDevelopmentSample, onCoordinationReady: b => { bridge = b; } });
    return service;
  }
  const service = make();
  t.after(() => { db.close(); if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
  return { service, db: () => db, bridge: () => bridge, access: () => access, advance: n => { clock += n; },
    secret: () => secret, setSecret: value => { secret = value; },
    onRead: fn => { onRead = fn; }, onWrite: fn => { onWrite = fn; }, fault: fn => { fault = fn; },
    reopen: () => { if (!onDisk) throw Error('Disk required'); db.close(); db = new DatabaseSync(file); return make(); } };
}
async function prepared(t, disk = false) {
  const h = harness(t, disk); await h.service.setup('123456', '123456'); const capability = await h.service.unlock('123456');
  await h.service.loadDevelopmentSample(capability); const ticket = h.bridge().captureParentTicket(capability);
  const envelope = JSON.parse(h.db().prepare('SELECT payload FROM installation').get().payload);
  const doc = envelope.state.assignments[0];
  const request = { operationId: 'receipt-one', idempotencyKey: 'request-one', kind: 'create_binding', installationRef: envelope.credentialId,
    assetId: 'asset-one', bindingId: 'binding-one', assignmentId: doc.assignment.id, sourceId: doc.assignment.sources[0].id,
    originatingContentRevision: doc.contentRevision, expectedContentRevision: doc.contentRevision, expectedWriteRevision: doc.writeRevision,
    referenceEpoch: 1, reservationGeneration: 1, payloadDigest: null };
  const run = (r = request, mutate = null, target = ticket) => h.bridge().withParentTicket(target, guard => h.access().updateWithReferenceReceipt(r, mutate, guard));
  return { h, capability, ticket, request, doc, run };
}

test('exact replay still requires a current ticket and cannot invalidate a newer session', async t => {
  const { h, run, ticket, request } = await prepared(t); await run();
  h.service.lock();
  await assert.rejects(run(), { code: 'parent_locked' });
  const capability = await h.service.unlock('123456');
  const fresh = h.bridge().captureParentTicket(capability);
  await assert.rejects(run(request, null, ticket), { code: 'parent_locked' });
  assert.equal((await run(request, null, fresh)).replayed, true);
  h.advance(300000);
  await assert.rejects(run(request, null, fresh), { code: 'parent_locked' });
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 1);
});

test('private recovery reads reject absent guards and forged or revoked tickets', async t => {
  const { h, ticket, run } = await prepared(t); await run();
  for (const method of ['readVerifiedInstallationIdentity', 'readReferenceReceipts']) {
    assert.equal(Object.hasOwn(h.service, method), false);
    await assert.rejects(h.access()[method](), { code: 'invalid_authorization_bridge' });
    await assert.rejects(h.bridge().withParentTicket(JSON.parse(JSON.stringify(ticket)), guard => h.access()[method](guard)), { code: 'parent_locked' });
  }
  h.service.lock();
  await assert.rejects(h.bridge().withParentTicket(ticket, guard => h.access().readReferenceReceipts(guard)), { code: 'parent_locked' });
});

test('every request field participates in replay integrity', async t => {
  const { run, request } = await prepared(t); await run();
  const changes = { operationId: 'other-operation', idempotencyKey: 'other-key', kind: 'retire_binding',
    installationRef: 'other-installation', assetId: 'other-asset', bindingId: 'other-binding', assignmentId: 'other-assignment',
    sourceId: 'other-source', originatingContentRevision: 2, expectedContentRevision: 2, expectedWriteRevision: 2,
    referenceEpoch: 2, reservationGeneration: 2, payloadDigest: 'a'.repeat(64) };
  assert.deepEqual(Object.keys(changes).sort(), Object.keys(request).sort());
  for (const [key, value] of Object.entries(changes)) {
    assert.notEqual(fingerprint(request), fingerprint({ ...request, [key]: value }), key);
    if (key === 'payloadDigest') continue; // A digest also requires a mutator; verified separately below.
    await assert.rejects(run({ ...request, [key]: value }), { code: key === 'installationRef' ? 'scope_mismatch' : 'receipt_conflict' }, key);
  }
  await assert.rejects(run({ ...request, payloadDigest: changes.payloadDigest }, () => { throw Error('Replay must not mutate'); }), { code: 'receipt_conflict' });
});

test('receipt sequence increases across a real database restart without replay increment', async t => {
  const { h, run, request } = await prepared(t, true); const first = await run();
  const reopened = h.reopen(); const capability = await reopened.unlock('123456');
  const ticket = h.bridge().captureParentTicket(capability);
  const replay = await run(request, null, ticket);
  const second = await run({ ...request, operationId: 'receipt-two', idempotencyKey: 'request-two' }, null, ticket);
  assert.equal(replay.receipt.sequence, first.receipt.sequence);
  assert.ok(second.receipt.sequence > first.receipt.sequence);
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 2);
});

test('failure at first protected SQL issuance leaves no receipt or payload change', async t => {
  const { h, run } = await prepared(t);
  const before = h.db().prepare('SELECT payload FROM installation').get().payload;
  h.fault(sql => sql.startsWith('INSERT INTO household_reference_receipts'));
  await assert.rejects(run(), { code: 'household_coordination_failed' });
  assert.equal(h.db().prepare('SELECT payload FROM installation').get().payload, before);
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 0);
  h.fault(() => false); assert.equal((await run()).replayed, false);
});

test('final authorization check catches revocation inside the synchronous mutation before SQL issuance', async t => {
  const { h, run, request, doc } = await prepared(t);
  const next = structuredClone(doc); next.assignment.title = 'Isolated mutation'; next.contentRevision++; next.writeRevision++;
  const before = h.db().prepare('SELECT payload FROM installation').get().payload;
  let inserts = 0; h.onWrite(sql => { if (sql.startsWith('INSERT INTO household_reference_receipts')) inserts++; });
  await assert.rejects(run({ ...request, payloadDigest: fingerprint(next) }, state => {
    state.assignments[0] = next; h.service.lock(); return state;
  }), { code: 'parent_locked' });
  assert.equal(inserts, 0);
  assert.equal(h.db().prepare('SELECT payload FROM installation').get().payload, before);
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 0);
});
test('internal bridge/accessor are absent from public API and reveal no credential', async t => {
  const { h, ticket } = await prepared(t);
  assert.equal(Object.hasOwn(h.service, 'captureParentTicket'), false); assert.equal(Object.hasOwn(h.service, 'readVerifiedInstallationIdentity'), false);
  const identity = await h.bridge().withParentTicket(ticket, guard => h.access().readVerifiedInstallationIdentity(guard));
  assert.deepEqual(identity, { installationRef: 'installation-test' }); assert.equal(JSON.stringify(ticket), '{}');
  assert.equal(JSON.stringify(identity).includes('fixture'), false);
  await assert.rejects(h.bridge().withParentTicket({}, async () => identity), { code: 'parent_locked' });
});
test('old ticket rejects without locking a newer unlocked session', async t => {
  const { h, ticket } = await prepared(t); h.service.lock(); const current = await h.service.unlock('123456');
  await assert.rejects(h.bridge().withParentTicket(ticket, async () => 'private'), { code: 'parent_locked' });
  const fresh = h.bridge().captureParentTicket(current);
  assert.equal(await h.bridge().withParentTicket(fresh, async () => 1), 1);
});
test('coordinator reads do not renew five-minute activity, explicit activity still works', async t => {
  const { h, ticket, capability } = await prepared(t);
  h.advance(299999); await h.bridge().withParentTicket(ticket, guard => h.access().readVerifiedInstallationIdentity(guard));
  h.advance(1); await assert.rejects(h.bridge().withParentTicket(ticket, async () => 1), { code: 'parent_locked' });
  const next = await h.service.unlock('123456'); h.advance(299999); h.service.noteParentActivity(next);
  h.advance(2); assert.ok(h.bridge().captureParentTicket(next)); assert.notEqual(next, capability);
});
test('receipt-only insert preserves exact payload bytes and revisions; replay is exact', async t => {
  const { h, run } = await prepared(t); const before = h.db().prepare('SELECT payload FROM installation').get().payload;
  const first = await run(); const replay = await run();
  assert.equal(first.receipt.sequence, replay.receipt.sequence); assert.equal(replay.replayed, true);
  assert.equal(h.db().prepare('SELECT payload FROM installation').get().payload, before);
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 1);
  assert.equal(JSON.stringify(first).includes('fixture'), false);
});
test('conflicting identities, fingerprints and stale source/revision reject', async t => {
  const { run, request } = await prepared(t); await run();
  for (const delta of [{ bindingId: 'other-binding' }, { idempotencyKey: 'other-key' }, { operationId: 'other-operation' }]) await assert.rejects(run({ ...request, ...delta }), { code: 'receipt_conflict' });
  await assert.rejects(run({ ...request, operationId: 'new-op', idempotencyKey: 'new-key', expectedWriteRevision: 999 }), { code: 'stale_assignment' });
  await assert.rejects(run({ ...request, operationId: 'new-op', idempotencyKey: 'new-key', sourceId: 'absent' }), { code: 'source_not_found' });
});
test('legacy absent writeRevision remains zero without normalization', async t => {
  const { h, run, request } = await prepared(t);
  const envelope = JSON.parse(h.db().prepare('SELECT payload FROM installation').get().payload); delete envelope.state.assignments[0].writeRevision;
  const raw = JSON.stringify(envelope, null, 2); h.db().prepare('UPDATE installation SET payload=?').run(raw);
  const result = await run({ ...request, expectedWriteRevision: 0 });
  assert.equal(result.receipt.write_revision, 0); assert.equal(h.db().prepare('SELECT payload FROM installation').get().payload, raw);
});
test('authorized target mutation and receipt roll back together, then commit once', async t => {
  const { h, run, request, doc } = await prepared(t); const next = structuredClone(doc);
  next.assignment.title = 'Changed in isolated test'; next.contentRevision++; next.writeRevision++;
  const r = { ...request, payloadDigest: fingerprint(next) };
  const mutation = state => { state.assignments[0] = structuredClone(next); return state; };
  const before = h.db().prepare('SELECT payload FROM installation').get().payload;
  h.fault(sql => sql.startsWith('UPDATE installation SET payload='));
  await assert.rejects(run(r, mutation)); h.fault(() => false);
  assert.equal(h.db().prepare('SELECT payload FROM installation').get().payload, before);
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 0);
  await run(r, mutation); await run(r, () => { throw Error('Replay must not execute'); });
  assert.equal(JSON.parse(h.db().prepare('SELECT payload FROM installation').get().payload).state.assignments[0].writeRevision, 2);
});
test('async or unrelated household mutation and wrong payload digest reject', async t => {
  const { run, request } = await prepared(t); const r = { ...request, payloadDigest: 'a'.repeat(64) };
  await assert.rejects(run(r, async s => s), { code: 'async_household_mutation' });
  await assert.rejects(run(r, s => { s.household.failures++; return s; }), { code: 'invalid_household_mutation' });
  await assert.rejects(run(r, s => s), { code: 'payload_fingerprint_mismatch' });
});
test('revoked before durable receipt issuance rejects with no side effects', async t => {
  const { h, run } = await prepared(t);
  h.onRead(sql => { if (sql.startsWith('SELECT * FROM household_reference_receipts')) h.service.lock(); });
  await assert.rejects(run(), { code: 'parent_locked' }); h.onRead(() => {});
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 0);
});
test('revocation after valid issuance permits atomic completion but suppresses response', async t => {
  const { h, run } = await prepared(t);
  h.onWrite(async sql => { if (sql.startsWith('INSERT INTO household_reference_receipts')) h.service.lock(); });
  await assert.rejects(run(), { code: 'parent_locked' });
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 1);
  h.onWrite(async () => {}); const current = await h.service.unlock('123456'); assert.ok(h.bridge().captureParentTicket(current));
});
test('missing/malformed/mismatched SecureStore and pending installations are not repaired', async t => {
  const { h, ticket } = await prepared(t); const saved = h.secret();
  const read = () => h.bridge().withParentTicket(ticket, guard => h.access().readVerifiedInstallationIdentity(guard));
  for (const secret of [null, '{', JSON.stringify({ id: 'wrong', record: { fixture: 'valid' } }), JSON.stringify({ id: 'installation-test', record: {} })]) {
    h.setSecret(secret); await assert.rejects(read());
  }
  h.setSecret(saved); h.db().exec("UPDATE installation SET phase='pending'");
  await assert.rejects(read(), { code: 'installation_not_ready' });
  assert.equal(h.db().prepare('SELECT phase FROM installation').get().phase, 'pending');
});
test('additive schema preserves installation payload on open/reopen; real disk receipt durability', async t => {
  const { h, run } = await prepared(t, true); const raw = h.db().prepare('SELECT payload FROM installation').get().payload;
  await run(); const restarted = h.reopen(); const capability = await restarted.unlock('123456');
  const ticket = h.bridge().captureParentTicket(capability);
  const rows = await h.bridge().withParentTicket(ticket, guard => h.access().readReferenceReceipts(guard));
  assert.equal(rows.length, 1); assert.equal(rows[0].sequence, 1);
  assert.equal(h.db().prepare('SELECT payload FROM installation').get().payload, raw);
});
test('revocation after issuance completes payload and receipt together', async t => {
  const { h, run, request, doc } = await prepared(t); const next = structuredClone(doc);
  next.assignment.title = 'Atomic isolated update'; next.writeRevision++; next.contentRevision++;
  h.onWrite(async sql => { if (sql.startsWith('INSERT INTO household_reference_receipts')) h.service.lock(); });
  await assert.rejects(run({ ...request, payloadDigest: fingerprint(next) }, state => { state.assignments[0] = next; return state; }), { code: 'parent_locked' });
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 1);
  assert.equal(JSON.parse(h.db().prepare('SELECT payload FROM installation').get().payload).state.assignments[0].assignment.title, next.assignment.title);
});
test('late protected response cannot alter a newly unlocked session', async t => {
  const { h, run } = await prepared(t); let release; let issued;
  const wait = new Promise(resolve => { issued = resolve; });
  h.onWrite(async sql => { if (sql.startsWith('INSERT INTO household_reference_receipts')) { issued(); await new Promise(resolve => { release = resolve; }); } });
  const old = run(); const rejected = assert.rejects(old, { code: 'parent_locked' }); await wait;
  h.service.lock(); const unlocking = h.service.unlock('123456'); release(); await rejected;
  const next = await unlocking; h.onWrite(async () => {});
  const ticket = h.bridge().captureParentTicket(next);
  assert.equal(await h.bridge().withParentTicket(ticket, async () => 'current'), 'current');
});
test('unknown or malformed receipt schema/data fail closed even on an open adapter', async t => {
  const { h, run, ticket } = await prepared(t); await run();
  h.db().exec('PRAGMA ignore_check_constraints=ON; UPDATE household_reference_meta SET version=99');
  const read = () => h.bridge().withParentTicket(ticket, guard => h.access().readVerifiedInstallationIdentity(guard));
  await assert.rejects(read(), { code: 'unsupported_receipt_schema' });
  h.db().exec("UPDATE household_reference_meta SET version=1; UPDATE household_reference_receipts SET request_json='{}'");
  await assert.rejects(read(), { code: 'invalid_receipt_store' });
});
test('schema creation is additive for an existing ready household; failed creation rolls back', async t => {
  const { h } = await prepared(t, true); const raw = h.db().prepare('SELECT payload FROM installation').get().payload;
  h.db().exec('DROP TABLE household_reference_receipts; DROP TABLE household_reference_meta');
  h.fault(sql => sql.startsWith('CREATE TABLE household_reference_meta'));
  const failed = h.reopen(); await assert.rejects(failed.status());
  assert.equal(h.db().prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE 'household_reference_%'").get().n, 0);
  assert.equal(h.db().prepare('SELECT payload FROM installation').get().payload, raw);
  h.fault(() => false); const fresh = h.reopen(); await fresh.status();
  assert.equal(h.db().prepare('SELECT payload FROM installation').get().payload, raw);
});
test('caller-supplied receipts/scope cannot bypass internal request checks', async t => {
  const { run, request } = await prepared(t);
  await assert.rejects(run({ ...request, outcome: 'applied' }), { code: 'invalid_receipt_request' });
  await assert.rejects(run({ ...request, installationRef: 'different-installation' }), { code: 'scope_mismatch' });
});
test('expiry during transaction reads rejects before first durable receipt write', async t => {
  const { h, run } = await prepared(t); let expired = false;
  h.onRead(sql => { if (!expired && sql.startsWith('SELECT * FROM household_reference_receipts')) { expired = true; h.advance(300000); } });
  await assert.rejects(run(), { code: 'parent_locked' });
  assert.equal(h.db().prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n, 0);
});
test('must-not-exist assignment receipt commits new target atomically and replays', async t => {
  const { h, run, request, doc } = await prepared(t);
  const next = structuredClone(doc); next.assignment.id = 'new-assignment'; next.purpose = 'household_assignment';
  const r = { ...request, assignmentId: next.assignment.id, expectedContentRevision: null, expectedWriteRevision: null, payloadDigest: fingerprint(next) };
  await run(r, state => { state.assignments.push(next); return state; });
  const replay = await run(r, () => { throw Error('No duplicate creation'); }); assert.equal(replay.replayed, true);
  assert.equal(JSON.parse(h.db().prepare('SELECT payload FROM installation').get().payload).state.assignments.length, 2);
});
