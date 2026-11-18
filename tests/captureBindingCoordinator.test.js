const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHouseholdService } = require('../src/services/householdService');
const { createSqliteStore } = require('../src/services/storage/sqliteStore');
const { createCaptureSqliteStore } = require('../src/services/storage/captureSqliteStore');
const { createCaptureBindingCoordinator } = require('../src/services/captureBindingCoordinator');
const { createDevelopmentSample } = require('../src/content/developmentSample');

// Independent real SQLite databases; synthetic identity/credentials and Expo-shaped bridge.
// No installed household or image files are read. These are not Android-native tests.
async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-binding-'));
  let householdDb; let captureDb; let clock = 100; let secret = null; let entity = 0; let worker = 0;
  let fault = () => false; let after = async () => {}; let authority; let references; let capture; let service; let store; let capability;
  function bridge(db, kind) {
    let queue = Promise.resolve();
    function check(sql) { if (fault(kind, sql)) throw Error('Injected SQL interruption'); }
    const tx = {
      async execAsync(sql) { check(sql); db.exec(sql); },
      async getFirstAsync(sql, ...args) { check(sql); return db.prepare(sql).get(...args); },
      async getAllAsync(sql, ...args) { check(sql); return db.prepare(sql).all(...args); },
      async runAsync(sql, ...args) { check(sql); const result = db.prepare(sql).run(...args); await after(kind, sql); return result; },
    };
    return { async execAsync(sql) { db.exec(sql); }, withExclusiveTransactionAsync(fn) {
      const next = queue.then(async () => {
        db.exec('BEGIN IMMEDIATE');
        try { await fn(tx); check('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
        db.exec('COMMIT'); await after(kind, 'COMMIT');
      }); queue = next.catch(() => {}); return next;
    } };
  }
  function open() {
    householdDb = new DatabaseSync(path.join(directory, 'household.db'));
    captureDb = new DatabaseSync(path.join(directory, 'capture.db'));
    const hb = bridge(householdDb, 'household'); const cb = bridge(captureDb, 'capture');
    const credential = { valid: r => r?.fixture === 'valid', create: async () => ({ fixture: 'valid' }), verify: async () => true };
    const householdStore = createSqliteStore({ openDatabase: async () => hb, secureStore: { getItemAsync: async () => secret, setItemAsync: async (key, value) => { secret = value; } },
      randomId: async () => 'installation-one', validCredential: credential.valid, coordinationNow: () => clock, onCoordinationReady: a => { references = a; } });
    service = createHouseholdService({ store: householdStore, credential, now: () => clock, development: true, sampleProvider: createDevelopmentSample, onCoordinationReady: a => { authority = a; } });
    store = createCaptureSqliteStore({ openDatabase: async () => cb, now: () => clock, newId: () => `entity-${++entity}`,
      trustedInstallationIdentity: () => authority.withParentTicket(authority.captureParentTicket(capability), guard => references.readVerifiedInstallationIdentity(guard)), onCoordinationReady: a => { capture = a; } });
  }
  open(); t.after(() => { householdDb.close(); captureDb.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  await service.setup('123456', '123456'); capability = await service.unlock('123456'); await service.loadDevelopmentSample(capability);
  await capture.bootstrap();
  const metadata = (operationId, expectedRevision, command, args) => ({ operationId, idempotencyKey: operationId, expectedRevision, type: 'metadata', command, args, captureId: null, assetId: null });
  const created = await store.applyMetadata(metadata('create-one', 1, 'createCapture', [])); const captureId = created.manifest.captures[0].id;
  const adoption = await store.reserveAdoption({ operationId: 'adoption-one', idempotencyKey: 'adoption-key', expectedRevision: 2, type: 'adoption', command: null, args: [], captureId, assetId: null },
    { captureId, sourceUri: 'file:///synthetic.jpg', method: 'camera', width: 1200, height: 1600, mime: 'image/jpeg' });
  await store.claimAdoption('adoption-one', 'adoption-worker');
  await store.checkpointAdoption('adoption-one', 'adoption-worker', 'hashed', { digest: 'a'.repeat(64), bytes: 100 });
  await store.checkpointAdoption('adoption-one', 'adoption-worker', 'finalized'); await store.checkpointAdoption('adoption-one', 'adoption-worker', 'completed');
  await store.applyMetadata(metadata('save-one', 3, 'save', [captureId]));
  const doc = JSON.parse(householdDb.prepare('SELECT payload FROM installation').get().payload).state.assignments[0];
  const request = { operationId: 'bind-one', idempotencyKey: 'bind-key', kind: 'bind', assetId: adoption.assetId, assignmentId: doc.assignment.id,
    sourceId: doc.assignment.sources[0].id, bindingId: 'binding-one', expectedManifestRevision: 4, expectedReferenceEpoch: 0,
    householdRevisions: [{ assignmentId: doc.assignment.id, contentRevision: doc.contentRevision, writeRevision: doc.writeRevision }], receiptOperationId: 'receipt-one' };
  function coordinator(overrides = {}) { return createCaptureBindingCoordinator({ household: service, parentBridge: authority, householdReferences: references,
    capture, newOwner: () => `worker-${++worker}`, now: () => clock, ...overrides }); }
  return { request, metadata, doc, get store() { return store; }, get capture() { return capture; }, get service() { return service; }, get references() { return references; },
    get authority() { return authority; }, get capability() { return capability; }, get db() { return captureDb; }, get householdDb() { return householdDb; },
    coordinator, bind: (r = request) => coordinator().bind(capability, r), advance: ms => { clock += ms; }, fault: fn => { fault = fn; }, after: fn => { after = fn; },
    unlock: async () => { capability = await service.unlock('123456'); },
    reopen: async () => { householdDb.close(); captureDb.close(); open(); capability = await service.unlock('123456'); },
    payload: () => householdDb.prepare('SELECT payload FROM installation').get().payload,
    receipts: () => householdDb.prepare('SELECT count(*) AS n FROM household_reference_receipts').get().n };
}

test('authorized binding and exact replay preserve household bytes, revisions and trust', async t => {
  const h = await fixture(t); const before = h.payload();
  assert.deepEqual(await h.bind(), { bindingId: 'binding-one', replayed: false });
  assert.deepEqual(await h.bind(), { bindingId: 'binding-one', replayed: true });
  assert.equal(h.payload(), before); assert.equal(h.receipts(), 1);
  const manifest = await h.store.load(); assert.equal(manifest.revision, 5); assert.equal(manifest.bindings.length, 1);
  assert.deepEqual(manifest.bindings[0], { id: 'binding-one', assignmentId: h.request.assignmentId, sourceId: h.request.sourceId, contentRevision: 1, assetId: h.request.assetId });
  const op = (await h.capture.inspect()).operations[0]; assert.equal(op.phase, 'complete'); assert.equal(op.receiptState, 'applied');
  assert.equal((await h.capture.inspect()).referenceEpoch, 2);
});
test('conflicting request never retargets an existing receipt or binding', async t => {
  const h = await fixture(t); await h.bind();
  await assert.rejects(h.bind({ ...h.request, bindingId: 'other-binding' }), { code: 'idempotency_conflict' });
  assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings[0].id, 'binding-one');
});
test('untrusted scope, retirement, new-assignment and multi-document requests are rejected', async t => {
  const h = await fixture(t);
  await assert.rejects(h.bind({ ...h.request, installationRef: 'caller' }), { code: 'invalid_coordination' });
  await assert.rejects(h.bind({ ...h.request, kind: 'retire' }), { code: 'invalid_binding_request' });
  await assert.rejects(h.bind({ ...h.request, householdRevisions: [] }), { code: 'invalid_binding_request' });
  await assert.rejects(h.bind({ ...h.request, assignmentId: 'absent', householdRevisions: [{ assignmentId: 'absent', contentRevision: 1, writeRevision: 1 }] }), { code: 'assignment_not_found' });
  assert.equal(h.receipts(), 0);
});
test('capture binding, manifest journal and completion roll back together', async t => {
  const h = await fixture(t);
  for (const prefix of ['UPDATE repository SET', 'INSERT INTO operations', 'UPDATE scope_binding SET reference_epoch=reference_epoch+1', 'UPDATE coordination_operations SET', 'COMMIT']) {
    // Recovery claim writes the operation row too; fail completion only after manifest revision changed in this transaction.
    h.fault((kind, sql) => kind === 'capture' && sql.startsWith(prefix) && (!['UPDATE coordination_operations SET', 'COMMIT'].includes(prefix) || h.db.prepare('SELECT revision FROM repository').get().revision === 5));
    await assert.rejects(h.bind()); h.fault(() => false);
    assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).revision, 4); assert.equal((await h.store.load()).bindings.length, 0);
    h.advance(60000);
  }
  await h.unlock(); await h.bind(); assert.equal(h.receipts(), 1);
});
test('reservation committed without receipt recovers across process restart', async t => {
  const h = await fixture(t); const reserve = h.capture.reserve;
  const interrupted = h.coordinator({ capture: { ...h.capture, reserve: async r => { await reserve(r); throw Error('Stopped after reservation'); } } });
  await assert.rejects(interrupted.bind(h.capability, h.request)); assert.equal(h.receipts(), 0);
  await h.reopen(); await h.bind(); assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 1);
});
test('receipt committed without binding recovers across restart using the same identities', async t => {
  const h = await fixture(t);
  h.fault((kind, sql) => kind === 'capture' && sql.startsWith('UPDATE repository SET'));
  await assert.rejects(h.bind()); assert.equal(h.receipts(), 1); h.fault(() => false);
  h.advance(60000); await h.reopen(); await h.bind(); assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings[0].id, 'binding-one');
});
test('binding completion committed with lost acknowledgement replays after restart', async t => {
  const h = await fixture(t); let stopped = false;
  h.after(async (kind, sql) => { if (!stopped && kind === 'capture' && sql === 'COMMIT' && h.db.prepare('SELECT revision FROM repository').get().revision === 5) { stopped = true; throw Error('Lost acknowledgement'); } });
  await assert.rejects(h.bind()); h.after(async () => {}); await h.reopen();
  assert.equal((await h.bind()).replayed, true); assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 1);
});
test('revocation before receipt SQL issuance creates no receipt and recovery requires reauthorization', async t => {
  const h = await fixture(t); const issue = h.references.updateWithReferenceReceipt;
  const coordinator = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: (r, mutation, guard) => { h.service.lock(); return issue(r, mutation, guard); } } });
  await assert.rejects(coordinator.bind(h.capability, h.request), { code: 'parent_locked' });
  assert.equal(h.receipts(), 0); await assert.rejects(h.bind(), { code: 'parent_locked' });
  h.advance(60000); await h.unlock(); await h.bind(); assert.equal(h.receipts(), 1);
});
test('revocation after valid household issuance commits only receipt and suppresses result', async t => {
  const h = await fixture(t); const before = h.payload();
  h.after(async (kind, sql) => { if (kind === 'household' && sql.startsWith('INSERT INTO household_reference_receipts')) h.service.lock(); });
  await assert.rejects(h.bind(), { code: 'parent_locked' }); assert.equal(h.receipts(), 1); assert.equal(h.payload(), before);
  assert.equal(h.db.prepare('SELECT revision FROM repository').get().revision, 4);
  h.after(async () => {}); h.advance(60000); await h.unlock(); await h.bind(); assert.equal(h.receipts(), 1);
});
test('expiry before issuance and stale capability cannot invalidate a newer parent session', async t => {
  const h = await fixture(t); const old = h.capability; h.advance(300000);
  await assert.rejects(h.bind(), { code: 'parent_locked' }); assert.equal(h.receipts(), 0);
  await h.unlock(); await assert.rejects(h.coordinator().bind(old, h.request), { code: 'parent_locked' }); await h.bind();
});
test('missing or stale assignment source blocks without manufacturing a receipt', async t => {
  const h = await fixture(t);
  await assert.rejects(h.bind({ ...h.request, sourceId: 'absent-source' }), { code: 'source_not_found' });
  await assert.rejects(h.bind({ ...h.request, householdRevisions: [{ ...h.request.householdRevisions[0], writeRevision: 99 }] }), { code: 'stale_assignment' });
  assert.equal(h.receipts(), 0);
});
test('document correction between reservation and issuance is rejected by household transaction', async t => {
  const h = await fixture(t); const validate = h.capture.validateIssuance;
  const coordinator = h.coordinator({ capture: { ...h.capture, validateIssuance: async (...args) => {
    await validate(...args); const e = JSON.parse(h.payload()); e.state.assignments[0].writeRevision++;
    h.householdDb.prepare('UPDATE installation SET payload=?').run(JSON.stringify(e));
  } } });
  await assert.rejects(coordinator.bind(h.capability, h.request), { code: 'stale_assignment' }); assert.equal(h.receipts(), 0);
});
test('manifest or reference epoch changed after receipt blocks capture commit without rebase', async t => {
  const h = await fixture(t); const issue = h.references.updateWithReferenceReceipt;
  const coordinator = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: async (...args) => {
    const result = await issue(...args); await h.store.applyMetadata(h.metadata('other-capture', 4, 'createCapture', [])); return result;
  } } });
  await assert.rejects(coordinator.bind(h.capability, h.request), { code: 'stale_revision' }); assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 0);
});
test('fence introduced after receipt remains protective and blocks completion', async t => {
  const h = await fixture(t); const issue = h.references.updateWithReferenceReceipt;
  const coordinator = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: async (...args) => {
    const result = await issue(...args); await h.capture.reserve({ ...h.request, operationId: 'fence-one', idempotencyKey: 'fence-key', kind: 'discover_delete',
      assignmentId: null, sourceId: null, bindingId: null, receiptOperationId: null, householdRevisions: [], expectedReferenceEpoch: 1 }); return result;
  } } });
  await assert.rejects(coordinator.bind(h.capability, h.request)); assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 0);
  assert.equal((await h.capture.inspect()).fences.length, 1);
});
test('missing or corrupt receipt evidence never completes a binding', async t => {
  const h = await fixture(t);
  const coordinator = h.coordinator({ householdReferences: { ...h.references, readReferenceReceipts: async () => [], updateWithReferenceReceipt: async () => ({}) } });
  await assert.rejects(coordinator.bind(h.capability, h.request), { code: 'receipt_mismatch' });
  assert.equal((await h.store.load()).bindings.length, 0); assert.equal(h.receipts(), 0);
});
test('scope mismatch, unavailable household and malformed capture state fail closed', async t => {
  const h = await fixture(t);
  const mismatch = h.coordinator({ householdReferences: { ...h.references, readVerifiedInstallationIdentity: async () => ({ installationRef: 'wrong-installation' }) } });
  await assert.rejects(mismatch.bind(h.capability, h.request), { code: 'scope_mismatch' });
  h.fault(kind => kind === 'household'); await assert.rejects(h.bind()); h.fault(() => false);
  h.db.exec("UPDATE scope_binding SET generation=2"); await assert.rejects(h.bind(), { code: 'invalid_coordination' }); assert.equal(h.receipts(), 0);
});
test('public metadata dispatch cannot create bindings', async t => {
  const h = await fixture(t);
  await assert.rejects(h.store.applyMetadata(h.metadata('caller-bind', 4, 'bind', ['binding-one', { assignmentId: h.request.assignmentId, sourceId: h.request.sourceId, contentRevision: 1, assetId: h.request.assetId }])));
  assert.equal((await h.store.load()).bindings.length, 0);
});

test('expired lease and takeover reject an old worker at capture binding commit', async t => {
  const h = await fixture(t); const commit = h.capture.commitBinding;
  const coordinator = h.coordinator({ capture: { ...h.capture, commitBinding: async (...args) => {
    h.advance(60000); await h.capture.claim(h.request.operationId, args[1], 'replacement-worker'); return commit(...args);
  } } });
  await assert.rejects(coordinator.bind(h.capability, h.request), { code: 'stale_owner' });
  assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 0);
  assert.equal((await h.capture.inspect()).operations[0].owner, 'replacement-worker');
});
test('lease expiry before household SQL issuance cannot initiate a receipt', async t => {
  const h = await fixture(t); const issue = h.references.updateWithReferenceReceipt;
  const coordinator = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: (...args) => { h.advance(60000); return issue(...args); } } });
  await assert.rejects(coordinator.bind(h.capability, h.request), { code: 'stale_owner' }); assert.equal(h.receipts(), 0);
});
test('authorization revoked after first capture write permits atomic completion but suppresses response', async t => {
  const h = await fixture(t); const before = h.payload();
  h.after(async (kind, sql) => { if (kind === 'capture' && sql.startsWith('UPDATE repository SET')) h.service.lock(); });
  await assert.rejects(h.bind(), { code: 'parent_locked' });
  assert.equal((await h.store.load()).bindings.length, 1); assert.equal(h.receipts(), 1); assert.equal(h.payload(), before);
  h.after(async () => {}); await h.unlock(); assert.equal((await h.bind()).replayed, true);
});
test('household revision change after receipt prevents capture completion', async t => {
  const h = await fixture(t); const issue = h.references.updateWithReferenceReceipt;
  const coordinator = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: async (...args) => {
    const result = await issue(...args); const e = JSON.parse(h.payload()); e.state.assignments[0].writeRevision++;
    h.householdDb.prepare('UPDATE installation SET payload=?').run(JSON.stringify(e)); return result;
  } } });
  await assert.rejects(coordinator.bind(h.capability, h.request), { code: 'stale_assignment' });
  assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 0);
});
test('unrelated reservation epoch change prevents completion without silent rebasing', async t => {
  const h = await fixture(t); const issue = h.references.updateWithReferenceReceipt;
  const coordinator = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: async (...args) => {
    const result = await issue(...args); await h.capture.reserve({ ...h.request, operationId: 'bind-two', idempotencyKey: 'key-two', bindingId: 'binding-two', receiptOperationId: 'receipt-two', expectedReferenceEpoch: 1 }); return result;
  } } });
  await assert.rejects(coordinator.bind(h.capability, h.request), { code: 'stale_epoch' });
  assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 0);
});
test('conflicting durable receipt fingerprint is rejected rather than adopted as completion', async t => {
  const h = await fixture(t); const read = h.references.readReferenceReceipts;
  const coordinator = h.coordinator({ householdReferences: { ...h.references, readReferenceReceipts: async guard => (await read(guard)).map(r => ({ ...r, request_fingerprint: '0'.repeat(64) })) } });
  await assert.rejects(coordinator.bind(h.capability, h.request), { code: 'receipt_mismatch' });
  assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 0);
});
test('completed capture without durable household receipt cannot replay success', async t => {
  const h = await fixture(t); await h.bind(); h.householdDb.exec('DELETE FROM household_reference_receipts');
  await assert.rejects(h.bind(), { code: 'receipt_missing' }); assert.equal((await h.store.load()).bindings.length, 1);
});

test('preexisting protective fence prevents receipt issuance', async t => {
  const h = await fixture(t);
  await h.capture.reserve({ ...h.request, operationId: 'fence-one', idempotencyKey: 'fence-key', kind: 'discover_delete', assignmentId: null, sourceId: null, bindingId: null, receiptOperationId: null, householdRevisions: [] });
  await assert.rejects(h.bind({ ...h.request, expectedReferenceEpoch: 1 }), { code: 'asset_fenced' }); assert.equal(h.receipts(), 0);
});

test('unverified asset cannot cause receipt issuance even though reservation metadata is permitted', async t => {
  const h = await fixture(t);
  await h.store.recordImageObservation('unknown-observation', 4, h.request.assetId, { status: 'available', integrity: 'unknown' });
  await assert.rejects(h.bind({ ...h.request, expectedManifestRevision: 5 }), { code: 'invalid_transition' }); assert.equal(h.receipts(), 0);
});

test('failure before reservation commits leaves no operation, epoch change or receipt after restart', async t => {
  const h = await fixture(t); const before = h.payload();
  h.fault((kind, sql) => kind === 'capture' && sql.startsWith('INSERT INTO coordination_operations'));
  await assert.rejects(h.bind(), { code: 'persistence_failed' }); h.fault(() => false);
  assert.equal(h.receipts(), 0); assert.equal(h.payload(), before);
  assert.deepEqual(await h.capture.inspect(), { referenceEpoch: 0, operations: [], fences: [] });
  await h.reopen(); await h.bind(); assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 1);
});

test('household receipt commit with lost acknowledgement recovers from durable evidence after restart', async t => {
  const h = await fixture(t); const before = h.payload(); let stopped = false;
  h.after(async (kind, sql) => {
    if (!stopped && kind === 'household' && sql === 'COMMIT' && h.receipts() === 1) { stopped = true; throw Error('Lost receipt acknowledgement'); }
  });
  await assert.rejects(h.bind(), { code: 'household_coordination_failed' });
  assert.equal(stopped, true); assert.equal(h.receipts(), 1); assert.equal(h.payload(), before);
  assert.equal(h.db.prepare('SELECT revision FROM repository').get().revision, 4);
  h.after(async () => {}); h.advance(60000); await h.reopen(); await h.bind(); await h.bind();
  assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 1); assert.equal(h.payload(), before);
});

test('durable receipt revision or identity corruption blocks recovery without altering historical targets', async t => {
  const h = await fixture(t);
  h.fault((kind, sql) => kind === 'capture' && sql.startsWith('UPDATE repository SET'));
  await assert.rejects(h.bind()); h.fault(() => false); h.advance(60000); await h.reopen();
  h.householdDb.exec('UPDATE household_reference_receipts SET content_revision=content_revision+1');
  await assert.rejects(h.bind(), { code: 'receipt_mismatch' });
  assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 0);
  h.householdDb.exec("UPDATE household_reference_receipts SET installation_ref='unexpected-installation'");
  h.advance(60000); await assert.rejects(h.bind(), { code: 'invalid_receipt_store' });
  assert.equal(h.receipts(), 1); assert.equal((await h.store.load()).bindings.length, 0);
});
