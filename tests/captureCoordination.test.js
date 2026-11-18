const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCaptureSqliteStore } = require('../src/services/storage/captureSqliteStore');

// Isolated real SQLite, fake trusted identity and Expo-shaped bridge; not Android proof.
function harness(t, disk = false) {
  const directory = disk ? fs.mkdtempSync(path.join(os.tmpdir(), 'fc-capture-coordination-')) : null;
  const filename = directory ? path.join(directory, 'isolated.db') : ':memory:';
  let db = new DatabaseSync(filename); let clock = 100; let identity = { installationRef: 'installation-one' };
  let queue = Promise.resolve(); let count = 0; let fault = () => false; let coordinator;
  function check(sql) { if (fault(sql)) throw Error('Injected failure'); }
  const tx = {
    async execAsync(sql) { check(sql); db.exec(sql); },
    async getFirstAsync(sql, ...args) { check(sql); return db.prepare(sql).get(...args); },
    async getAllAsync(sql, ...args) { check(sql); return db.prepare(sql).all(...args); },
    async runAsync(sql, ...args) { check(sql); return db.prepare(sql).run(...args); },
  };
  const bridge = { withExclusiveTransactionAsync(fn) {
    const next = queue.then(async () => { db.exec('BEGIN IMMEDIATE'); try { await fn(tx); check('COMMIT'); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } });
    queue = next.catch(() => {}); return next;
  } };
  function make(provider = async () => identity) {
    return createCaptureSqliteStore({ openDatabase: async () => bridge, newId: () => `entity-${++count}`, now: () => clock,
      trustedInstallationIdentity: provider, onCoordinationReady: value => { coordinator = value; } });
  }
  let store = make();
  t.after(() => { db.close(); if (directory) fs.rmSync(directory, { recursive: true, force: true }); });
  return { get store() { return store; }, get api() { return coordinator; }, get db() { return db; },
    identity: value => { identity = value; }, advance: ms => { clock += ms; }, fault: fn => { fault = fn; },
    make, reopen: () => { if (disk) { db.close(); db = new DatabaseSync(filename); } store = make(); } };
}
const metadata = (operationId, expectedRevision) => ({ operationId, idempotencyKey: operationId, expectedRevision, type: 'metadata', command: 'createCapture', args: [], captureId: null, assetId: null });
async function prepared(t, disk = false) {
  const h = harness(t, disk); await h.api.bootstrap();
  const m = (await h.store.applyMetadata(metadata('create-one', 1))).manifest;
  const captureId = m.captures[0].id;
  const r = { operationId: 'adopt-one', idempotencyKey: 'adopt-one', expectedRevision: 2, type: 'adoption', command: null, args: [], captureId, assetId: null };
  const a = await h.store.reserveAdoption(r, { captureId, sourceUri: 'file:///synthetic.jpg', method: 'camera', width: 1200, height: 1600, mime: 'image/jpeg' });
  await h.store.claimAdoption('adopt-one', 'adopt-worker');
  await h.store.checkpointAdoption('adopt-one', 'adopt-worker', 'hashed', { digest: 'a'.repeat(64), bytes: 100 });
  await h.store.checkpointAdoption('adopt-one', 'adopt-worker', 'finalized');
  await h.store.checkpointAdoption('adopt-one', 'adopt-worker', 'completed');
  const request = { operationId: 'reference-one', idempotencyKey: 'reference-key', kind: 'bind', assetId: a.assetId,
    assignmentId: 'assignment-one', sourceId: 'source-one', bindingId: 'binding-one', expectedManifestRevision: 3,
    expectedReferenceEpoch: 0, householdRevisions: [{ assignmentId: 'assignment-one', contentRevision: 1, writeRevision: 1 }], receiptOperationId: 'receipt-one' };
  return { h, request };
}
const fence = request => ({ ...request, operationId: 'fence-one', idempotencyKey: 'fence-key', kind: 'discover_delete', assignmentId: null, sourceId: null, bindingId: null, receiptOperationId: null, householdRevisions: [] });

test('empty v4 initialization, explicit private bootstrap and exact replay reveal no identity publicly', async t => {
  const h = harness(t); assert.deepEqual(await h.api.bootstrap(), { generation: 1, referenceEpoch: 0 });
  assert.deepEqual(await h.api.bootstrap(), { generation: 1, referenceEpoch: 0 });
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 4);
  assert.equal(h.store.bootstrap, undefined); assert.equal(h.store.reserve, undefined);
  assert.equal(JSON.stringify(await h.store.inspect()).includes('installation-one'), false);
  await assert.rejects(h.api.bootstrap({ householdId: 'caller' }), { code: 'invalid_coordination' });
});
test('unknown/malformed identities and silent rebinding fail closed', async t => {
  const h = harness(t);
  for (const value of [null, {}, { installationRef: '' }, { installationRef: 'installation-one', householdId: 'caller' }]) {
    h.identity(value); await assert.rejects(h.api.bootstrap());
  }
  h.identity({ installationRef: 'installation-one' }); await h.api.bootstrap();
  h.identity({ installationRef: 'installation-two' }); await assert.rejects(h.api.bootstrap(), { code: 'scope_mismatch' });
  await assert.rejects(h.api.inspect(), { code: 'scope_mismatch' });
  h.make(null); await assert.rejects(h.api.bootstrap(), { code: 'identity_unavailable' });
});
test('nonempty unbound repository cannot be claimed', async t => {
  const h = harness(t); await h.store.applyMetadata(metadata('create-one', 1));
  await assert.rejects(h.api.bootstrap(), { code: 'unbound_repository_nonempty' });
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM scope_binding').get().n, 0);
});
test('reservation preserves manifest, binding graph and adoption journal; exact lost acknowledgement replay', async t => {
  const { h, request } = await prepared(t); const before = await h.store.inspect();
  const first = await h.api.reserve(request); const replay = await h.api.reserve(request);
  assert.equal(replay.replayed, true); assert.deepEqual(replay.operation, first.operation);
  assert.deepEqual(await h.store.inspect(), before);
  assert.equal(first.operation.receiptState, 'unknown'); assert.equal(first.operation.issuedAt, null); assert.equal(first.operation.completedAt, null);
  assert.equal((await h.api.inspect()).referenceEpoch, 1);
});
test('all request fields fingerprint replay and caller scope selectors are rejected', async t => {
  const { h, request } = await prepared(t); await h.api.reserve(request);
  for (const delta of [{ assetId: 'other-asset' }, { bindingId: 'other-binding' }, { expectedManifestRevision: 4 },
    { expectedReferenceEpoch: 1 }, { receiptOperationId: 'other-receipt' }, { operationId: 'other-operation' }, { idempotencyKey: 'other-key' },
    { householdRevisions: [{ assignmentId: 'assignment-one', contentRevision: 1, writeRevision: 2 }] }]) {
    await assert.rejects(h.api.reserve({ ...request, ...delta }), { code: 'idempotency_conflict' });
  }
  await assert.rejects(h.api.reserve({ ...request, installationRef: 'caller' }), { code: 'invalid_coordination' });
});
test('revision and epoch conflicts reject, including database-enforced CAS', async t => {
  const { h, request } = await prepared(t);
  await assert.rejects(h.api.reserve({ ...request, expectedManifestRevision: 2 }), { code: 'stale_revision' });
  await assert.rejects(h.api.reserve({ ...request, expectedReferenceEpoch: 1 }), { code: 'stale_epoch' });
  h.db.exec('CREATE TRIGGER ignore_epoch BEFORE UPDATE ON scope_binding BEGIN SELECT RAISE(IGNORE); END');
  await assert.rejects(h.api.reserve(request), { code: 'stale_epoch' });
  assert.equal((await h.api.inspect()).operations.length, 0);
});
test('two instances cannot reserve against the same epoch', async t => {
  const { h, request } = await prepared(t); const a = h.api; h.make(); const b = h.api;
  const outcomes = await Promise.allSettled([a.reserve(request), b.reserve({ ...request, operationId: 'other-operation', idempotencyKey: 'other-key', bindingId: 'binding-two', receiptOperationId: 'receipt-two' })]);
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(o => o.status === 'rejected').reason.code, 'stale_epoch');
});
test('reservation, epoch and fence roll back together on insertion or commit failure', async t => {
  const { h, request } = await prepared(t);
  for (const prefix of ['INSERT INTO coordination_operations', 'INSERT INTO coordination_fences', 'COMMIT']) {
    h.fault(sql => sql.startsWith(prefix)); await assert.rejects(h.api.reserve(fence(request)), { code: 'persistence_failed' }); h.fault(() => false);
    assert.deepEqual(await h.api.inspect(), { referenceEpoch: 0, operations: [], fences: [] });
  }
  await h.api.reserve(fence(request)); assert.equal((await h.api.inspect()).fences.length, 1);
});
test('persistent fence survives reopen and expired lease; takeover rejects stale owner', async t => {
  const { h, request } = await prepared(t, true); const r = fence(request);
  await h.api.reserve(r); const old = await h.api.claim(r.operationId, 0, 'worker-one');
  h.reopen(); await assert.rejects(h.api.claim(r.operationId, 1, 'worker-two'), { code: 'operation_busy' });
  h.advance(60000); const next = await h.api.claim(r.operationId, 1, 'worker-two'); assert.equal(next.ownerGeneration, 2);
  await assert.rejects(h.api.block(r.operationId, old.ownerGeneration, 'worker-one', 'receipt_unknown'), { code: 'stale_owner' });
  await assert.rejects(h.api.reserve({ ...request, expectedReferenceEpoch: 1 }), { code: 'asset_fenced' });
  assert.equal((await h.api.inspect()).fences.length, 1); assert.equal(h.api.release, undefined);
  assert.equal((await h.api.reserve(r)).replayed, true);
});
test('blocked receipt-unknown records stay protective and cannot fabricate completion', async t => {
  const { h, request } = await prepared(t); await h.api.reserve(request); await h.api.claim(request.operationId, 0, 'worker-one');
  const blocked = await h.api.block(request.operationId, 1, 'worker-one', 'receipt_unknown');
  assert.equal(blocked.phase, 'blocked'); assert.equal(blocked.receiptState, 'unknown');
  await assert.rejects(h.api.block(request.operationId, 1, 'worker-one', 'completed'), { code: 'invalid_coordination' });
  assert.equal(h.api.complete, undefined); assert.equal((await h.store.load()).bindings.length, 0);
  assert.equal(h.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE 'household%'").get().n, 0);
});
test('v2 migration preserves exact manifests, adoption identity/checkpoints and existing recovery journal', async t => {
  const { h } = await prepared(t, true); const before = await h.store.inspect();
  const captureId = before.manifest.captures[0].id;
  await h.store.registerOperation({ operationId: 'pending-adoption', idempotencyKey: 'pending-key', expectedRevision: 3, type: 'adoption', command: null, args: [], captureId, assetId: null });
  const recoveryBefore = await h.store.listRecovery(); const journalBefore = await h.store.inspect();
  const adoption = h.db.prepare('SELECT state FROM adoptions').get().state;
  h.db.exec('DROP TABLE retirement_events; DROP TABLE coordination_fences; DROP TABLE coordination_operations; DROP TABLE scope_binding; PRAGMA user_version=2');
  h.reopen(); assert.deepEqual(await h.store.inspect(), journalBefore);
  assert.deepEqual(await h.store.listRecovery(), recoveryBefore);
  assert.equal(h.db.prepare('SELECT state FROM adoptions').get().state, adoption);
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 4);
  await assert.rejects(h.api.bootstrap(), { code: 'unbound_repository_nonempty' });
});

test('pending work in an otherwise empty unbound repository prevents scope claiming', async t => {
  const h = harness(t);
  await h.store.registerOperation({ operationId: 'pending-one', idempotencyKey: 'pending-one', expectedRevision: 1, type: 'adoption', command: null, args: [], captureId: 'unknown-capture', assetId: null });
  await assert.rejects(h.api.bootstrap(), { code: 'unbound_repository_nonempty' });
});

test('binding reservation and receipt identities cannot be reused by another operation', async t => {
  const { h, request } = await prepared(t); await h.api.reserve(request);
  const next = { ...request, operationId: 'reference-two', idempotencyKey: 'reference-two', expectedReferenceEpoch: 1 };
  await assert.rejects(h.api.reserve({ ...next, receiptOperationId: 'receipt-two' }), { code: 'reference_conflict' });
  await assert.rejects(h.api.reserve({ ...next, bindingId: 'binding-two' }), { code: 'reference_conflict' });
  assert.equal((await h.api.inspect()).referenceEpoch, 1);
});

test('identity mismatch rejects reservation and recovery without exposing existing records', async t => {
  const { h, request } = await prepared(t); await h.api.reserve(request);
  h.identity({ installationRef: 'another-installation' });
  for (const action of [() => h.api.reserve(request), () => h.api.claim(request.operationId, 0, 'worker-one'), () => h.api.inspect()]) {
    await assert.rejects(action(), { code: 'scope_mismatch' });
  }
  h.identity({ installationRef: 'installation-one' }); assert.equal((await h.api.inspect()).referenceEpoch, 1);
});
test('interrupted migration rolls back without recreating or resetting existing data', async t => {
  const h = harness(t, true); await h.store.applyMetadata(metadata('create-one', 1)); const before = await h.store.inspect();
  h.db.exec('DROP TABLE retirement_events; DROP TABLE coordination_fences; DROP TABLE coordination_operations; DROP TABLE scope_binding; PRAGMA user_version=2');
  h.reopen(); h.fault(sql => sql.startsWith('CREATE TABLE scope_binding'));
  await assert.rejects(h.store.load()); h.fault(() => false);
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 2);
  assert.equal(h.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='scope_binding'").get().n, 0);
  assert.deepEqual(await h.store.inspect(), before);
});
test('future versions and partially initialized migration fail closed', async t => {
  const h = harness(t); await h.store.load();
  h.db.exec('PRAGMA user_version=99'); h.reopen(); await assert.rejects(h.store.load(), { code: 'unsupported_database_version' });
  h.db.exec('PRAGMA user_version=2'); h.reopen(); await assert.rejects(h.store.load(), { code: 'invalid_coordination' });
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 2);
});
test('malformed operation, orphan fence and unknown state fail closed on cached transactions', async t => {
  const { h, request } = await prepared(t); await h.api.reserve(fence(request));
  const raw = h.db.prepare('SELECT state FROM coordination_operations').get().state;
  for (const delta of [{ receiptState: 'applied' }, { phase: 'complete' }, { ownerGeneration: -1 }]) {
    h.db.prepare('UPDATE coordination_operations SET state=?').run(JSON.stringify({ ...JSON.parse(raw), ...delta }));
    await assert.rejects(h.store.load(), { code: 'invalid_coordination' });
  }
  h.db.prepare('UPDATE coordination_operations SET state=?').run(raw);
  h.db.exec('DELETE FROM coordination_fences'); await assert.rejects(h.store.load(), { code: 'invalid_coordination' });
});
