const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const { createCaptureSqliteStore } = require('../src/services/storage/captureSqliteStore');
const { createCaptureImageFiles } = require('../src/services/storage/captureImageFiles');
const { createCaptureImageAdoption } = require('../src/services/captureImageAdoption');

// Real isolated Node filesystem + real SQLite. Decoder/capacity are injected fakes.
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-adoption-'));
  const temporary = path.join(dir, 'temporary'); const owned = path.join(dir, 'owned');
  fs.mkdirSync(temporary); fs.mkdirSync(owned);
  const uri = p => pathToFileURL(p).href;
  const sourceUri = uri(path.join(temporary, 'worksheet.jpg')); fs.writeFileSync(fileURLToPath(sourceUri), Buffer.from('synthetic-image-one'));
  const dbPath = path.join(dir, 'capture.db'); let db = new DatabaseSync(dbPath); let queue = Promise.resolve();
  let serial = 0; let clock = 100; let fault = () => {}; let allowed = false;
  const point = kind => fault(kind);
  const tx = {
    async execAsync(sql) { point('sql'); db.exec(sql); },
    async getFirstAsync(sql, ...args) { return db.prepare(sql).get(...args); },
    async getAllAsync(sql, ...args) { return db.prepare(sql).all(...args); },
    async runAsync(sql, ...args) { if (sql.startsWith('UPDATE repository')) point('manifest'); return db.prepare(sql).run(...args); },
  };
  const database = { withExclusiveTransactionAsync(fn) {
    const next = queue.then(async () => { db.exec('BEGIN IMMEDIATE'); try { await fn(tx); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } });
    queue = next.catch(() => {}); return next;
  } };
  const driver = {
    async stat(u) { try { const s = fs.lstatSync(fileURLToPath(u)); if (s.isSymbolicLink()) throw Error('Symlink rejected'); return { exists: true, bytes: s.size, isFile: s.isFile() }; } catch (e) { if (e.code === 'ENOENT') return { exists: false }; throw e; } },
    async availableBytes() { point('capacity'); return 10000000; },
    async imageInfo() { return { width: 1000, height: 1400, mime: 'image/jpeg' }; },
    async mkdir(u) { fs.mkdirSync(fileURLToPath(u), { recursive: true }); },
    async *chunks(u, size) {
      point('hash'); const handle = await fs.promises.open(fileURLToPath(u), 'r');
      try { let buffer = Buffer.alloc(size); let read; do { read = await handle.read(buffer); if (read.bytesRead) yield buffer.subarray(0, read.bytesRead); } while (read.bytesRead); } finally { await handle.close(); }
    },
    async copyExclusive(a, b) { point('before_copy'); fs.copyFileSync(fileURLToPath(a), fileURLToPath(b), fs.constants.COPYFILE_EXCL); point('after_copy'); },
    async finalizeExclusive(a, b) { point('before_finalize'); fs.copyFileSync(fileURLToPath(a), fileURLToPath(b), fs.constants.COPYFILE_EXCL); point('after_finalize'); },
  };
  const files = createCaptureImageFiles({ driver, rootUri: uri(owned) + '/', temporaryRoots: [uri(temporary) + '/'] });
  function store() { return createCaptureSqliteStore({ openDatabase: async () => database, newId: () => `reserved-${++serial}`, now: () => clock }); }
  let current = store();
  function service(s = current) { return createCaptureImageAdoption({ store: s, files, newOwner: () => `worker-${++serial}`, now: () => clock, authorizedSavedScope: async () => allowed }); }
  t.after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { files, driver, sourceUri, service, store: () => current, fault: fn => { fault = fn; }, permit: value => { allowed = value; },
    reopen: () => { db.close(); db = new DatabaseSync(dbPath); current = store(); return current; }, tick: value => { clock = value; }, db: () => db,
    request: (captureId, revision, suffix = 'one') => ({ operationId: `operation-${suffix}`, idempotencyKey: `request-${suffix}`, expectedRevision: revision, type: 'adoption', command: null, args: [], captureId, assetId: null }),
    input: captureId => ({ captureId, sourceUri, method: 'camera', width: 1000, height: 1400, mime: 'image/jpeg' }),
    create: async (suffix = 'one') => {
      const m = await current.load(); return (await current.applyMetadata({ operationId: `create-${suffix}`, idempotencyKey: `create-request-${suffix}`, expectedRevision: m.revision, type: 'metadata', command: 'createCapture', args: [], captureId: null, assetId: null })).manifest;
    },
  };
}
test('verified adoption commits immutable identity and never modifies source', async t => {
  const f = fixture(t); const m = await f.create(); const c = m.captures[0].id;
  const before = fs.readFileSync(fileURLToPath(f.sourceUri));
  const result = await f.service().adopt(f.request(c, m.revision), f.input(c));
  assert.equal(result.observation.integrity, 'verified'); assert.equal(result.asset.sha256.length, 64);
  assert.deepEqual(fs.readFileSync(fileURLToPath(f.files.assetUri(result.asset.id))), before);
  assert.deepEqual(fs.readFileSync(fileURLToPath(f.sourceUri)), before);
  assert.equal((await f.service().availability(result.asset.id)).verification, 'not_recently_verified');
  const retry = await f.service().adopt(f.request(c, m.revision), f.input(c));
  assert.equal(retry.asset.id, result.asset.id); assert.equal((await f.store().load()).assets.length, 1);
  const restarted = f.reopen(); assert.equal((await restarted.adoptionState('operation-one')).phase, 'completed');
});
test('staging capacity/partial copy/hash mismatch never exposes an asset', async t => {
  for (const failure of ['capacity', 'partial', 'mismatch', 'missing']) {
    const f = fixture(t); const m = await f.create(); const c = m.captures[0].id;
    if (failure === 'capacity') f.driver.availableBytes = async () => 0;
    else f.driver.copyExclusive = async (a, b) => {
      if (failure === 'missing') return;
      fs.writeFileSync(fileURLToPath(b), failure === 'partial' ? 'part' : 'wrong-image-data-xx');
    };
    await assert.rejects(f.service().adopt(f.request(c, m.revision), f.input(c)));
    assert.equal((await f.store().load()).assets.length, 0); assert.ok(fs.existsSync(fileURLToPath(f.sourceUri)));
  }
});
for (const boundary of ['before_copy', 'after_copy', 'before_finalize', 'after_finalize', 'manifest']) {
  test(`restart recovery at ${boundary} preserves reservation and avoids duplicate assets`, async t => {
    const f = fixture(t); const m = await f.create(); const c = m.captures[0].id; let once = true;
    f.fault(kind => { if (once && kind === boundary) { once = false; throw Error('Injected interruption'); } });
    const request = f.request(c, m.revision); const input = f.input(c);
    await assert.rejects(f.service().adopt(request, input));
    const reserved = await f.store().adoptionState(request.operationId);
    f.fault(() => {}); f.reopen();
    const result = await f.service().adopt(request, input);
    assert.equal(result.asset.id, reserved.assetId); assert.equal((await f.store().load()).assets.length, 1);
  });
}
test('lost completion acknowledgement replays without another metadata commit', async t => {
  const f = fixture(t); const m = await f.create(); const c = m.captures[0].id; const store = f.store();
  const wrapped = { ...store, checkpointAdoption: async (...args) => { const r = await store.checkpointAdoption(...args); if (args[2] === 'completed') throw Error('Lost acknowledgement'); return r; } };
  await assert.rejects(f.service(wrapped).adopt(f.request(c, m.revision), f.input(c)));
  const rev = (await store.load()).revision; f.reopen();
  await f.service().adopt(f.request(c, m.revision), f.input(c)); assert.equal((await f.store().load()).revision, rev);
});
test('conflicting idempotency and stale commits are rejected with files retained', async t => {
  const f = fixture(t); const m = await f.create(); const c = m.captures[0].id;
  f.fault(kind => { if (kind === 'before_finalize') throw Error('Stop'); });
  await assert.rejects(f.service().adopt(f.request(c, m.revision), f.input(c)));
  await assert.rejects(f.service().adopt(f.request(c, m.revision), { ...f.input(c), width: 500 }), { code: 'idempotency_conflict' });
  f.fault(() => {}); await f.create('two');
  await assert.rejects(f.service().adopt(f.request(c, m.revision), f.input(c)), { code: 'stale_revision' });
  assert.equal((await f.store().load()).assets.length, 0);
});
test('exact duplicates are nonblocking, scoped and saved details remain private', async t => {
  const f = fixture(t); let m = await f.create(); const c = m.captures[0].id;
  await f.service().adopt(f.request(c, m.revision), f.input(c)); m = await f.store().load();
  const duplicate = await f.service().adopt(f.request(c, m.revision, 'two'), f.input(c));
  assert.deepEqual(duplicate.duplicates, [{ category: 'current_capture', count: 1 }]);
  m = await f.store().load(); await f.store().applyMetadata({ operationId: 'save-one', idempotencyKey: 'save-request', expectedRevision: m.revision, type: 'metadata', command: 'save', args: [c], captureId: null, assetId: null });
  m = await f.create('two'); const next = m.captures[1].id;
  const privateResult = await f.service().adopt(f.request(next, m.revision, 'three'), f.input(next));
  assert.deepEqual(privateResult.duplicates, []);
  f.permit(Object.freeze({}));
  const visible = await f.service().adopt(f.request(next, m.revision, 'three'), f.input(next));
  assert.deepEqual(visible.duplicates, [{ category: 'saved_worksheet', count: 2 }]);
  assert.equal(JSON.stringify(visible.duplicates).includes(c), false);
});
test('nonidentical bytes are not similar-rescan detection; explicit verification distinguishes corrupt/missing', async t => {
  const f = fixture(t); let m = await f.create(); const c = m.captures[0].id;
  const one = await f.service().adopt(f.request(c, m.revision), f.input(c)); m = await f.store().load();
  fs.writeFileSync(fileURLToPath(f.sourceUri), 'different-bytes');
  const two = await f.service().adopt(f.request(c, m.revision, 'two'), f.input(c)); assert.deepEqual(two.duplicates, []);
  fs.writeFileSync(fileURLToPath(f.files.assetUri(one.asset.id)), 'corrupted');
  assert.equal((await f.service().verify(one.asset.id)).integrity, 'corrupt');
  fs.unlinkSync(fileURLToPath(f.files.assetUri(one.asset.id)));
  assert.equal((await f.service().verify(one.asset.id)).status, 'unexpectedly_missing');
});
test('durable lease excludes concurrent owners and rejects stale owner checkpoint', async t => {
  const f = fixture(t); const m = await f.create(); const c = m.captures[0].id; const s = f.store();
  await s.reserveAdoption(f.request(c, m.revision), f.input(c)); await s.claimAdoption('operation-one', 'worker-a');
  await assert.rejects(s.claimAdoption('operation-one', 'worker-b'), { code: 'operation_busy' });
  f.tick(60101); await s.claimAdoption('operation-one', 'worker-b');
  await assert.rejects(s.checkpointAdoption('operation-one', 'worker-a', 'hashed', { digest: 'a'.repeat(64), bytes: 1 }), { code: 'ownership_lost' });
});
test('private source roots and immutable destination construction reject traversal and wrong metadata', async t => {
  const f = fixture(t); assert.throws(() => f.files.assetUri('../outside'));
  assert.throws(() => f.files.verifySource('file:///private-household.jpg'));
  assert.throws(() => f.files.verifySource(f.sourceUri + '/../other'));
  const m = await f.create(); await assert.rejects(f.service().adopt(f.request(m.captures[0].id, m.revision), { ...f.input(m.captures[0].id), width: 200 }), { code: 'metadata_mismatch' });
  assert.equal((await f.store().load()).assets.length, 0);
});
test('saved duplicate visibility is suppressed when authorization changes across discovery', async t => {
  const f = fixture(t); let m = await f.create(); const c = m.captures[0].id;
  await f.service().adopt(f.request(c, m.revision), f.input(c)); m = await f.store().load();
  await f.store().applyMetadata({ operationId: 'save-one', idempotencyKey: 'save-key', expectedRevision: m.revision, type: 'metadata', command: 'save', args: [c], captureId: null, assetId: null });
  m = await f.create('two'); const next = m.captures[1].id; let calls = 0;
  const service = createCaptureImageAdoption({ store: f.store(), files: f.files, newOwner: () => 'scoped-worker', now: () => 100,
    authorizedSavedScope: async () => ++calls === 1 ? Object.freeze({}) : null });
  const result = await service.adopt(f.request(next, m.revision, 'two'), f.input(next));
  assert.deepEqual(result.duplicates, []);
});
test('uncertain file state is not missing; IO errors do not disclose paths', async t => {
  const f = fixture(t); const m = await f.create(); const c = m.captures[0].id;
  const result = await f.service().adopt(f.request(c, m.revision), f.input(c));
  f.driver.stat = async () => ({ exists: undefined });
  await assert.rejects(f.service().verify(result.asset.id), { code: 'file_state_unknown' });
  f.driver.stat = async () => { throw Error('PRIVATE /arbitrary/image/path'); };
  await assert.rejects(f.service().verify(result.asset.id), e => e.code === 'image_io_failed' && !e.message.includes('PRIVATE'));
});
test('missing staged file after hashed checkpoint stays unresolved across restart', async t => {
  const f = fixture(t); const m = await f.create(); const c = m.captures[0].id;
  f.fault(kind => { if (kind === 'before_finalize') throw Error('Stop'); });
  await assert.rejects(f.service().adopt(f.request(c, m.revision), f.input(c)));
  const state = await f.store().adoptionState('operation-one');
  // Deliberate isolated fault injection only, never application cleanup.
  const parent = path.dirname(fileURLToPath(f.files.assetUri(state.assetId)));
  fs.unlinkSync(path.join(path.dirname(parent), 'staging', `operation-one-${state.stagingOwner}`));
  f.fault(() => {}); f.reopen();
  await assert.rejects(f.service().adopt(f.request(c, m.revision), f.input(c)), { code: 'image_missing' });
  assert.equal((await f.store().load()).assets.length, 0);
});
async function stopWithFinalFile(f, m, finalizedCheckpoint = false) {
  const c = m.captures[0].id; const request = f.request(c, m.revision); const input = f.input(c); const s = f.store();
  await s.reserveAdoption(request, input); await s.claimAdoption(request.operationId, 'interrupted-worker');
  const prepared = await f.files.prepare(input.sourceUri, request.operationId, 'interrupted-worker', async () => {});
  let state = await s.checkpointAdoption(request.operationId, 'interrupted-worker', 'hashed', { digest: prepared.digest, bytes: prepared.bytes });
  await f.files.finalize(request.operationId, 'interrupted-worker', state, async () => {});
  if (finalizedCheckpoint) state = await s.checkpointAdoption(request.operationId, 'interrupted-worker', 'finalized');
  // Deliberately no release/finally: represent durable state left by process death.
  return { state, request, input };
}
for (const checkpointed of [false, true]) {
  test(`final file survives process-stop recovery, finalized checkpoint=${checkpointed}`, async t => {
    const f = fixture(t); const m = await f.create(); const stopped = await stopWithFinalFile(f, m, checkpointed);
    const final = f.files.assetUri(stopped.state.assetId); const bytes = fs.readFileSync(fileURLToPath(final));
    const { createHash } = require('node:crypto');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), stopped.state.digest);
    f.reopen(); const durable = await f.store().adoptionState(stopped.request.operationId);
    assert.equal(durable.digest, stopped.state.digest); assert.equal(durable.assetId, stopped.state.assetId);
    assert.equal((await f.store().load()).assets.length, 0);
    await assert.rejects(f.service().adopt(stopped.request, stopped.input), { code: 'operation_busy' });
    f.tick(60101); let finalReads = 0; const chunks = f.driver.chunks;
    f.driver.chunks = async function* (uri, size) { if (uri === final) finalReads++; yield* chunks(uri, size); };
    f.driver.copyExclusive = async () => { throw Error('Must not copy again'); };
    f.driver.finalizeExclusive = async () => { throw Error('Must not overwrite final'); };
    const recovered = await f.service().adopt(stopped.request, stopped.input);
    assert.equal(recovered.asset.id, durable.assetId); assert.ok(finalReads > 0);
    assert.deepEqual(fs.readFileSync(fileURLToPath(final)), bytes);
    const committed = await f.store().load(); assert.equal(committed.assets.length, 1); assert.equal(committed.revision, m.revision + 1);
    await f.service().adopt(stopped.request, stopped.input);
    assert.equal((await f.store().load()).revision, committed.revision);
  });
}
test('finalized recovery rejects corrupt final bytes without metadata availability', async t => {
  const f = fixture(t); const m = await f.create(); const stopped = await stopWithFinalFile(f, m);
  fs.writeFileSync(fileURLToPath(f.files.assetUri(stopped.state.assetId)), 'corrupt-final');
  f.reopen(); f.tick(60101);
  await assert.rejects(f.service().adopt(stopped.request, stopped.input), { code: 'hash_mismatch' });
  assert.equal((await f.store().load()).assets.length, 0);
  assert.equal((await f.store().adoptionState(stopped.request.operationId)).phase, 'hashed');
});
test('finalized recovery rejects stale manifest without overwriting final', async t => {
  const f = fixture(t); const m = await f.create(); const stopped = await stopWithFinalFile(f, m, true);
  f.reopen(); f.tick(60101); await f.create('newer');
  f.driver.finalizeExclusive = async () => { throw Error('No overwrite'); };
  await assert.rejects(f.service().adopt(stopped.request, stopped.input), { code: 'stale_revision' });
  assert.equal((await f.store().load()).assets.length, 0);
});
test('caller-selected household/scope fields reject, and an unscoped service reveals no saved matches', async t => {
  const f = fixture(t); let m = await f.create(); const c = m.captures[0].id;
  await f.service().adopt(f.request(c, m.revision), f.input(c)); m = await f.store().load();
  await f.store().applyMetadata({ operationId: 'save-scope', idempotencyKey: 'save-scope-key', expectedRevision: m.revision, type: 'metadata', command: 'save', args: [c], captureId: null, assetId: null });
  m = await f.create('another'); const next = m.captures[1].id;
  await assert.rejects(f.service().adopt({ ...f.request(next, m.revision, 'other'), householdId: 'other-household' }, f.input(next)), { code: 'invalid_request' });
  await assert.rejects(f.service().adopt(f.request(next, m.revision, 'other'), { ...f.input(next), authorizedSavedScope: {} }), { code: 'invalid_request' });
  const service = createCaptureImageAdoption({ store: f.store(), files: f.files, newOwner: () => 'unscoped-worker', now: () => 100 });
  const result = await service.adopt(f.request(next, m.revision, 'other'), f.input(next));
  assert.deepEqual(result.duplicates, []); assert.equal((await f.store().load()).assets.length, 2);
});
