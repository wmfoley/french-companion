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

const { fingerprint } = require('../src/services/storage/householdReferenceReceipts');
async function retiredFixture(t) {
  const h = await fixture(t); await h.bind();
  const binding = (await h.store.load()).bindings[0];
  const request = { ...h.request, operationId: 'retire-one', idempotencyKey: 'retire-key', kind: 'retire', expectedManifestRevision: 5, expectedReferenceEpoch: 2,
    receiptOperationId: 'retirement-receipt', requestVersion: 2, retirementEventId: 'retirement-event', originatingContentRevision: binding.contentRevision, bindingFingerprint: fingerprint(binding) };
  return { h, request, retire: (r = request) => h.coordinator().retire(h.capability, r) };
}

test('fresh v4 ledger and successful retirement preserve original manifest, household and files boundary', async t => {
  const { h, request, retire } = await retiredFixture(t);
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 4);
  const manifest = h.db.prepare('SELECT manifest FROM repository').get().manifest; const household = h.payload();
  const journals = h.db.prepare('SELECT * FROM operations ORDER BY id').all();
  const result = await retire(); assert.equal(result.replayed, false); assert.equal(result.event.eventVersion, 1);
  assert.equal(result.event.bindingId, request.bindingId); assert.equal(result.event.committedReferenceEpoch, 4);
  assert.equal(h.db.prepare('SELECT manifest FROM repository').get().manifest, manifest); assert.equal(h.payload(), household);
  assert.deepEqual(h.db.prepare('SELECT * FROM operations ORDER BY id').all(), journals);
  const state = await h.capture.inspect(); assert.equal(state.referenceEpoch, 4); assert.equal(state.fences.length, 0);
  const operation = state.operations.find(o => o.request.kind === 'retire'); assert.equal(operation.recordVersion, 3); assert.equal(operation.completion.eventId, request.retirementEventId);
  assert.deepEqual(await h.capture.retirementEvents(), [result.event]); assert.equal(h.receipts(), 2);
});

test('reservation persists versioned identity and ownership without creating a discovery fence', async t => {
  const { h, request } = await retiredFixture(t); const reserved = await h.capture.reserve(request);
  assert.equal(reserved.operation.recordVersion, 3); assert.equal(reserved.operation.completion, null);
  assert.equal(reserved.operation.receiptState, 'unknown'); assert.equal((await h.capture.inspect()).referenceEpoch, 3);
  const claimed = await h.capture.claim(request.operationId, 0, 'retirement-worker'); assert.equal(claimed.ownerGeneration, 1);
  assert.equal((await h.capture.inspect()).fences.length, 0);
  assert.equal((await h.capture.reserve(request)).replayed, true);
});

test('exact replay returns the original event and conflicting or duplicate retirement rejects', async t => {
  const { h, request, retire } = await retiredFixture(t); const first = await retire(); h.advance(10);
  const replay = await retire(); assert.equal(replay.replayed, true); assert.deepEqual(replay.event, first.event);
  await assert.rejects(retire({ ...request, retirementEventId: 'other-event' }), { code: 'idempotency_conflict' });
  await assert.rejects(retire({ ...request, operationId: 'retire-two', idempotencyKey: 'retire-two', receiptOperationId: 'receipt-two', retirementEventId: 'event-two', expectedReferenceEpoch: 4 }), { code: 'already_retired' });
  assert.equal((await h.capture.retirementEvents()).length, 1); assert.equal(h.receipts(), 2);
});

test('retirement rejects caller scope, wrong binding fingerprint and target reassignment', async t => {
  const { h, request, retire } = await retiredFixture(t);
  for (const delta of [{ installationRef: 'caller' }, { bindingFingerprint: '0'.repeat(64) }, { bindingId: 'absent-binding' }, { assetId: 'other-asset' }]) await assert.rejects(retire({ ...request, ...delta }));
  assert.equal(h.receipts(), 1); assert.equal((await h.capture.retirementEvents()).length, 0);
});

test('retirement uses original binding revision while checking current household revisions', async t => {
  const { h, request, retire } = await retiredFixture(t);
  const e = JSON.parse(h.payload()); e.state.assignments[0].contentRevision = 2; e.state.assignments[0].writeRevision = 2;
  h.householdDb.prepare('UPDATE installation SET payload=?').run(JSON.stringify(e)); const before = h.payload();
  const result = await retire({ ...request, householdRevisions: [{ ...request.householdRevisions[0], contentRevision: 2, writeRevision: 2 }] });
  assert.equal(result.event.originatingContentRevision, 1); assert.equal(h.payload(), before);
  const row = h.householdDb.prepare("SELECT * FROM household_reference_receipts WHERE operation_id='retirement-receipt'").get();
  const input = JSON.parse(row.request_json); assert.equal(input.kind, 'retire_binding'); assert.equal(input.originatingContentRevision, 1); assert.equal(input.expectedContentRevision, 2); assert.equal(input.payloadDigest, null);
});

test('event, completion and epoch roll back together at every capture SQL/commit failure', async t => {
  const { h, retire } = await retiredFixture(t); const before = (await h.store.load());
  for (const prefix of ['UPDATE scope_binding SET reference_epoch=? WHERE id=1 AND installation_ref=', 'INSERT INTO retirement_events', 'UPDATE coordination_operations SET', 'COMMIT']) {
    h.fault((kind, sql) => kind === 'capture' && sql.startsWith(prefix) && (!['UPDATE coordination_operations SET', 'COMMIT'].includes(prefix) || h.db.prepare('SELECT reference_epoch FROM scope_binding').get().reference_epoch === 4));
    await assert.rejects(retire()); h.fault(() => false);
    assert.equal(h.receipts(), 2); assert.equal((await h.capture.retirementEvents()).length, 0);
    assert.equal((await h.capture.inspect()).referenceEpoch, 3); assert.deepEqual(await h.store.load(), before);
    h.advance(60000);
  }
  await h.unlock(); await retire(); assert.equal(h.receipts(), 2); assert.equal((await h.capture.retirementEvents()).length, 1);
});

test('reservation without receipt recovers after restart', async t => {
  const { h, request, retire } = await retiredFixture(t); await h.capture.reserve(request);
  await h.reopen(); await retire(); assert.equal(h.receipts(), 2); assert.equal((await h.capture.retirementEvents()).length, 1);
});

test('receipt committed with acknowledgement lost recovers from durable evidence after lease expiry', async t => {
  const { h, request, retire } = await retiredFixture(t); let stopped = false;
  h.after(async (kind, sql) => { if (!stopped && kind === 'household' && sql === 'COMMIT' && h.receipts() === 2) { stopped = true; throw Error('Lost retirement receipt acknowledgement'); } });
  await assert.rejects(retire()); assert.equal(h.receipts(), 2); h.after(async () => {});
  h.advance(60000); await h.reopen(); await retire(); assert.equal(h.receipts(), 2);
  assert.equal((await h.capture.retirementEvents())[0].eventId, request.retirementEventId);
});

test('event committed with acknowledgement lost replays exactly after restart', async t => {
  const { h, request, retire } = await retiredFixture(t); let stopped = false;
  h.after(async (kind, sql) => { if (!stopped && kind === 'capture' && sql === 'COMMIT' && h.db.prepare('SELECT count(*) AS n FROM retirement_events').get().n === 1) { stopped = true; throw Error('Lost event acknowledgement'); } });
  await assert.rejects(retire()); h.after(async () => {}); await h.reopen();
  const replay = await retire(); assert.equal(replay.replayed, true); assert.equal(replay.event.eventId, request.retirementEventId); assert.equal(h.receipts(), 2);
});

test('expired or revoked parent cannot issue retirement receipt', async t => {
  const { h, request, retire } = await retiredFixture(t); h.advance(300000);
  await assert.rejects(retire(), { code: 'parent_locked' }); assert.equal(h.receipts(), 1); await h.unlock();
  const issue = h.references.updateWithReferenceReceipt;
  const c = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: (...args) => { h.service.lock(); return issue(...args); } } });
  await assert.rejects(c.retire(h.capability, request), { code: 'parent_locked' }); assert.equal(h.receipts(), 1);
  h.advance(60000); await h.unlock(); await retire(); assert.equal(h.receipts(), 2);
});

test('post-issuance revoke preserves atomic receipt/event writes and suppresses results', async t => {
  const { h, retire } = await retiredFixture(t);
  h.after(async (kind, sql) => { if (kind === 'household' && sql.startsWith('INSERT INTO household_reference_receipts')) h.service.lock(); });
  await assert.rejects(retire(), { code: 'parent_locked' }); assert.equal(h.receipts(), 2);
  h.after(async () => {}); h.advance(60000); await h.unlock();
  h.after(async (kind, sql) => { if (kind === 'capture' && sql.startsWith('INSERT INTO retirement_events')) h.service.lock(); });
  await assert.rejects(retire(), { code: 'parent_locked' }); assert.equal((await h.store.load()).bindings.length, 1);
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM retirement_events').get().n, 1);
  h.after(async () => {}); await h.unlock(); assert.equal((await retire()).replayed, true);
});

test('stale recovery owner cannot complete retirement after takeover', async t => {
  const { h, request } = await retiredFixture(t); const commit = h.capture.commitRetirement;
  const c = h.coordinator({ capture: { ...h.capture, commitRetirement: async (...args) => { h.advance(60000); await h.capture.claim(request.operationId, args[1], 'new-retirement-owner'); return commit(...args); } } });
  await assert.rejects(c.retire(h.capability, request), { code: 'stale_owner' }); assert.equal(h.receipts(), 2); assert.equal((await h.capture.retirementEvents()).length, 0);
});

const discovery = (request, epoch) => ({ operationId: 'discovery-one', idempotencyKey: 'discovery-one', kind: 'discover_delete', assetId: request.assetId,
  assignmentId: null, sourceId: null, bindingId: null, expectedManifestRevision: 5, expectedReferenceEpoch: epoch, householdRevisions: [], receiptOperationId: null });
test('discovery fence blocks reservation and survives restart and lease expiry unchanged', async t => {
  const { h, request, retire } = await retiredFixture(t); await h.capture.reserve(discovery(request, 2));
  const before = h.db.prepare('SELECT * FROM coordination_fences').all();
  h.advance(60000); await h.reopen(); await assert.rejects(retire({ ...request, expectedReferenceEpoch: 3 }), { code: 'asset_fenced' });
  assert.deepEqual(h.db.prepare('SELECT * FROM coordination_fences').all(), before); assert.equal(h.receipts(), 1);
});

test('discovery fence arriving before completion blocks retirement without being changed or released', async t => {
  const { h, request } = await retiredFixture(t); const issue = h.references.updateWithReferenceReceipt;
  const c = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: async (...args) => { const result = await issue(...args); await h.capture.reserve(discovery(request, 3)); return result; } } });
  await assert.rejects(c.retire(h.capability, request)); assert.equal(h.receipts(), 2); assert.equal((await h.capture.retirementEvents()).length, 0);
  const before = h.db.prepare('SELECT * FROM coordination_fences').all(); h.advance(60000); await h.reopen();
  await assert.rejects(h.coordinator().recover(h.capability, request)); assert.deepEqual(h.db.prepare('SELECT * FROM coordination_fences').all(), before);
});

test('manifest, household revisions and source conflicts do not silently rebase', async t => {
  const { h, request, retire } = await retiredFixture(t);
  await assert.rejects(retire({ ...request, sourceId: 'missing-source' }), { code: 'source_not_found' });
  await assert.rejects(retire({ ...request, expectedManifestRevision: 4 }), { code: 'stale_revision' });
  await assert.rejects(retire({ ...request, expectedReferenceEpoch: 1 }), { code: 'stale_epoch' });
  await assert.rejects(retire({ ...request, householdRevisions: [{ ...request.householdRevisions[0], writeRevision: 99 }] }), { code: 'stale_assignment' }); assert.equal(h.receipts(), 1);
});

test('reference epoch SQL CAS and ignored completion writes cannot fabricate retirement', async t => {
  const { h, request, retire } = await retiredFixture(t);
  h.db.exec('CREATE TRIGGER ignore_epoch BEFORE UPDATE ON scope_binding BEGIN SELECT RAISE(IGNORE); END');
  await assert.rejects(retire(), { code: 'stale_epoch' }); h.db.exec('DROP TRIGGER ignore_epoch');
  h.db.exec("CREATE TRIGGER ignore_completion BEFORE UPDATE ON coordination_operations WHEN NEW.state LIKE '%\"phase\":\"complete\"%' BEGIN SELECT RAISE(IGNORE); END");
  await assert.rejects(retire(), { code: 'stale_owner' }); assert.equal(h.receipts(), 2); assert.equal((await h.capture.retirementEvents()).length, 0);
  assert.equal((await h.capture.inspect()).referenceEpoch, 3);
  assert.equal((await h.capture.inspect()).operations.find(o => o.request.operationId === request.operationId).receiptState, 'unknown');
});

test('receipt corruption and store scope mismatch block recovery without events', async t => {
  const { h, request, retire } = await retiredFixture(t); const commit = h.capture.commitRetirement;
  const c = h.coordinator({ capture: { ...h.capture, commitRetirement: async () => { throw Error('Stop before capture commit'); } } });
  await assert.rejects(c.retire(h.capability, request)); h.advance(60000);
  h.householdDb.exec("UPDATE household_reference_receipts SET content_revision=9 WHERE operation_id='retirement-receipt'");
  await assert.rejects(retire(), { code: 'receipt_mismatch' }); assert.equal((await h.capture.retirementEvents()).length, 0);
  assert.equal(typeof commit, 'function');
  const wrong = h.coordinator({ householdReferences: { ...h.references, readVerifiedInstallationIdentity: async () => ({ installationRef: 'wrong-household' }) } });
  await assert.rejects(wrong.retire(h.capability, request), { code: 'scope_mismatch' });
});

test('completed retirement remains historically readable after assignment correction', async t => {
  const { h, retire } = await retiredFixture(t); const first = await retire();
  const e = JSON.parse(h.payload()); e.state.assignments[0].contentRevision++; e.state.assignments[0].writeRevision++;
  h.householdDb.prepare('UPDATE installation SET payload=?').run(JSON.stringify(e));
  assert.deepEqual((await retire()).event, first.event); assert.equal((await h.store.load()).bindings.length, 1);
});

test('event and completion malformed states fail closed without repair', async t => {
  const { h, retire } = await retiredFixture(t); await retire();
  const row = h.db.prepare('SELECT * FROM retirement_events').get();
  h.db.prepare('UPDATE retirement_events SET event_json=?').run('{}'); await assert.rejects(h.store.load(), { code: 'invalid_retirement' });
  h.db.prepare('UPDATE retirement_events SET event_json=?').run(row.event_json);
  h.db.exec('DELETE FROM retirement_events'); await assert.rejects(h.store.load(), { code: 'invalid_retirement' });
});

function canonicalRecord(value) {
  if (Array.isArray(value)) return value.map(canonicalRecord);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonicalRecord(value[k])])) : value;
}
const rawTables = h => Object.fromEntries(['repository', 'operations', 'adoptions', 'scope_binding', 'coordination_operations', 'coordination_fences'].map(name => [name, h.db.prepare(`SELECT * FROM ${name} ORDER BY 1`).all()]));
test('v3 migration preserves completed bindings, pending creation, adoption and recovery bytes', async t => {
  const { h } = await retiredFixture(t);
  const pending = { ...h.request, operationId: 'pending-bind', idempotencyKey: 'pending-key', bindingId: 'pending-binding', receiptOperationId: 'pending-receipt', expectedManifestRevision: 5, expectedReferenceEpoch: 2 };
  await h.capture.reserve(pending); const before = rawTables(h);
  h.db.exec('DROP TABLE retirement_events; PRAGMA user_version=3'); await h.reopen(); await h.store.load();
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 4); assert.deepEqual(rawTables(h), before);
  assert.deepEqual(await h.capture.retirementEvents(), []);
  await h.coordinator().recover(h.capability, pending); assert.equal((await h.store.load()).bindings.length, 2);
});

test('legacy pending retirement is preserved and blocked, never silently upgraded', async t => {
  const { h, request, retire } = await retiredFixture(t);
  const legacy = { ...h.request, operationId: 'legacy-retire', idempotencyKey: 'legacy-key', kind: 'retire', receiptOperationId: 'legacy-receipt', expectedManifestRevision: 5, expectedReferenceEpoch: 2 };
  const op = { recordVersion: 1, request: legacy, installationRef: 'installation-one', fingerprint: fingerprint({ installationRef: 'installation-one', request: legacy }), reservationGeneration: 3,
    ownerGeneration: 0, owner: null, leaseUntil: 0, phase: 'reserved', receiptState: 'unknown', createdAt: 100, updatedAt: 100, issuedAt: null, completedAt: null, errorCode: null };
  h.db.prepare('INSERT INTO coordination_operations VALUES(?,?,?)').run(legacy.operationId, legacy.idempotencyKey, JSON.stringify(canonicalRecord(op)));
  h.db.exec('UPDATE scope_binding SET reference_epoch=3; DROP TABLE retirement_events; PRAGMA user_version=3');
  const before = rawTables(h); await h.reopen(); await h.store.load(); assert.deepEqual(rawTables(h), before);
  await assert.rejects(retire({ ...request, expectedReferenceEpoch: 3 }), { code: 'legacy_retirement_reconciliation_required' });
  await assert.rejects(h.capture.claim(legacy.operationId, 0, 'worker-one'), { code: 'legacy_retirement_reconciliation_required' });
  await assert.rejects(h.coordinator().recover(h.capability, legacy), { code: 'legacy_retirement_reconciliation_required' });
  assert.equal(h.receipts(), 1); assert.deepEqual(rawTables(h), before);
});

test('v3 migration SQL failure rolls back version and all original rows', async t => {
  const { h } = await retiredFixture(t); const before = rawTables(h);
  h.db.exec('DROP TABLE retirement_events; PRAGMA user_version=3'); await h.reopen();
  h.fault((kind, sql) => kind === 'capture' && sql.startsWith('CREATE TABLE retirement_events'));
  await assert.rejects(h.store.load()); h.fault(() => false);
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 3); assert.deepEqual(rawTables(h), before);
  assert.equal(h.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='retirement_events'").get().n, 0);
  await h.store.load(); assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 4); assert.deepEqual(rawTables(h), before);
});

test('future schema, missing ledger and ambiguous partial migration are never repaired', async t => {
  const { h } = await retiredFixture(t);
  h.db.exec('PRAGMA user_version=99'); await h.reopen(); await assert.rejects(h.store.load(), { code: 'unsupported_database_version' });
  h.db.exec('PRAGMA user_version=3'); await h.reopen(); await assert.rejects(h.store.load(), { code: 'invalid_retirement' });
  h.db.exec('PRAGMA user_version=4; DROP TABLE retirement_events'); await h.reopen(); await assert.rejects(h.store.load(), { code: 'invalid_retirement' });
  assert.equal(h.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='retirement_events'").get().n, 0);
});

test('lease expiry does not permit old owner to issue a new retirement receipt', async t => {
  const { h, request } = await retiredFixture(t); const issue = h.references.updateWithReferenceReceipt;
  const c = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: (...args) => { h.advance(60000); return issue(...args); } } });
  await assert.rejects(c.retire(h.capability, request), { code: 'stale_owner' });
  assert.equal(h.receipts(), 1); assert.equal((await h.capture.retirementEvents()).length, 0); assert.equal((await h.capture.inspect()).referenceEpoch, 3);
});

test('unrelated epoch advance prevents retirement completion without changing historical binding', async t => {
  const { h, request } = await retiredFixture(t); const issue = h.references.updateWithReferenceReceipt;
  const c = h.coordinator({ householdReferences: { ...h.references, updateWithReferenceReceipt: async (...args) => {
    const value = await issue(...args);
    await h.capture.reserve({ ...h.request, operationId: 'other-binding-op', idempotencyKey: 'other-binding-key', bindingId: 'other-binding', receiptOperationId: 'other-binding-receipt', expectedManifestRevision: 5, expectedReferenceEpoch: 3 }); return value;
  } } });
  await assert.rejects(c.retire(h.capability, request), { code: 'stale_epoch' }); assert.equal(h.receipts(), 2); assert.equal((await h.capture.retirementEvents()).length, 0);
  assert.equal((await h.store.load()).bindings[0].id, request.bindingId);
});

test('v4 missing required ledger index fails closed without silently recreating it', async t => {
  const { h } = await retiredFixture(t); h.db.exec('DROP INDEX retirement_events_scope');
  await assert.rejects(h.store.load(), { code: 'invalid_retirement' }); await h.reopen();
  await assert.rejects(h.store.load(), { code: 'invalid_retirement' });
  assert.equal(h.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='retirement_events_scope'").get().n, 0);
});
