const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createCaptureSqliteStore, DATABASE_NAME } = require('../src/services/storage/captureSqliteStore');

// Real SQLite, with an Expo-shaped async bridge. Native Expo execution is NOT tested.
function harness(filename = ':memory:') {
  const db = new DatabaseSync(filename); let queue = Promise.resolve(); let fault = null; let sequence = 0;
  const opened = [];
  function inject(sql) { if (fault && fault(sql)) throw new Error('Injected SQL failure'); }
  const tx = {
    async execAsync(sql) { inject(sql); db.exec(sql); },
    async getFirstAsync(sql, ...args) { inject(sql); return db.prepare(sql).get(...args); },
    async getAllAsync(sql, ...args) { inject(sql); return db.prepare(sql).all(...args); },
    async runAsync(sql, ...args) { inject(sql); return db.prepare(sql).run(...args); },
  };
  const bridge = {
    withExclusiveTransactionAsync(fn) {
      const next = queue.then(async () => {
        db.exec('BEGIN IMMEDIATE');
        try { await fn(tx); inject('COMMIT'); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      }); queue = next.catch(() => {}); return next;
    },
  };
  const factory = () => createCaptureSqliteStore({ openDatabase: async name => { opened.push(name); return bridge; },
    newId: () => `entity-${++sequence}`, now: () => 100 });
  return { db, factory, opened, fault: value => { fault = value; } };
}
const request = (extra = {}) => ({ operationId: 'operation-one', idempotencyKey: 'request-one', expectedRevision: 1,
  type: 'metadata', command: 'createCapture', args: [], captureId: null, assetId: null, ...extra });
const external = (extra = {}) => request({ type: 'adoption', command: null, captureId: 'capture-one', ...extra });
test('fresh isolated initialization has canonical v1 authority and no household tables', async () => {
  const h = harness(); const store = h.factory(); const m = await store.load();
  assert.equal(m.revision, 1); assert.equal(m.captures.length, 0); assert.deepEqual(h.opened, [DATABASE_NAME]);
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 3);
  assert.deepEqual(h.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name), ['adoptions', 'coordination_fences', 'coordination_operations', 'operations', 'repository', 'scope_binding']);
  h.db.close();
});
test('metadata commit and defensive load round trip', async () => {
  const h = harness(); const s = h.factory(); const result = await s.applyMetadata(request());
  assert.equal(result.manifest.revision, 2); assert.equal(result.operation.phase, 'completed');
  result.manifest.captures[0].status = 'saved'; result.operation.request.args.push('private');
  const loaded = await s.load(); assert.equal(loaded.captures[0].status, 'draft');
  assert.equal((await s.inspect()).operations[0].request.args.length, 0); h.db.close();
});
test('actual on-disk SQLite persists through close/reopen with incomplete operations', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fc-capture-sqlite-')); const file = path.join(directory, 'isolated.db');
  try {
    const first = harness(file); await first.factory().registerOperation(external()); first.db.close();
    const second = harness(file); const pending = await second.factory().listRecovery();
    assert.equal(pending.length, 1); assert.equal(pending[0].phase, 'pending'); assert.equal(pending[0].requiresAdapter, true);
    second.db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('identical replay cannot duplicate a metadata commit, including after other updates', async () => {
  const h = harness(); const s = h.factory(); const first = await s.applyMetadata(request());
  const second = await s.applyMetadata(request()); assert.equal(second.replayed, true); assert.equal(second.manifest.revision, 2);
  await s.applyMetadata(request({ operationId: 'operation-two', idempotencyKey: 'request-two', expectedRevision: 2 }));
  const replay = await h.factory().applyMetadata(request());
  assert.equal(replay.operation.committed_revision, first.operation.committed_revision); assert.equal(replay.manifest.revision, 3);
  assert.equal((await s.inspect()).operations.length, 2); h.db.close();
});
test('idempotency key and operation identity conflicts reject', async () => {
  const h = harness(); const s = h.factory(); await s.registerOperation(external());
  await assert.rejects(s.registerOperation(external({ assetId: 'different-asset' })), { code: 'idempotency_conflict' });
  await assert.rejects(s.registerOperation(external({ idempotencyKey: 'different-request' })), { code: 'idempotency_conflict' });
  assert.equal((await s.registerOperation(external())).replayed, true); h.db.close();
});
test('two store instances conflict rather than overwrite', async () => {
  const h = harness(); const a = h.factory(); const b = h.factory();
  const results = await Promise.allSettled([a.applyMetadata(request()), b.applyMetadata(request({ operationId: 'operation-two', idempotencyKey: 'request-two' }))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'stale_revision');
  assert.equal((await a.load()).captures.length, 1); h.db.close();
});
test('database CAS reports conflict even if a write is ignored after the JS check', async () => {
  const h = harness(); const s = h.factory(); await s.load();
  h.db.exec('CREATE TRIGGER ignore_write BEFORE UPDATE ON repository BEGIN SELECT RAISE(IGNORE); END');
  await assert.rejects(s.applyMetadata(request()), { code: 'stale_revision' });
  assert.equal((await s.load()).revision, 1); assert.equal((await s.inspect()).operations.length, 0); h.db.close();
});
test('journal insertion failure rolls back manifest and permits deterministic retry', async () => {
  const h = harness(); const s = h.factory(); await s.load();
  h.fault(sql => sql.startsWith('INSERT INTO operations'));
  await assert.rejects(s.applyMetadata(request()), { code: 'persistence_failed' });
  h.fault(null); assert.equal((await s.load()).revision, 1); assert.equal((await s.inspect()).operations.length, 0);
  assert.equal((await s.applyMetadata(request())).manifest.revision, 2); h.db.close();
});
test('interruption before commit leaves neither manifest nor journal changes', async () => {
  const h = harness(); const s = h.factory(); await s.load(); h.fault(sql => sql === 'COMMIT');
  await assert.rejects(s.applyMetadata(request()), { code: 'persistence_failed' }); h.fault(null);
  const restarted = h.factory(); assert.equal((await restarted.load()).revision, 1); assert.equal((await restarted.inspect()).operations.length, 0); h.db.close();
});
test('initial schema migration rollback never silently accepts a partial schema', async () => {
  const h = harness(); h.fault(sql => sql.startsWith('INSERT INTO repository'));
  await assert.rejects(h.factory().load()); assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 0);
  assert.equal(h.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get().n, 0);
  h.fault(null); assert.equal((await h.factory().load()).revision, 1); h.db.close();
});
test('unknown versions and unversioned nonempty databases are preserved', async () => {
  for (const setup of ['PRAGMA user_version=99', 'CREATE TABLE private_existing(x)']) {
    const h = harness(); h.db.exec(setup); await assert.rejects(h.factory().load());
    if (setup.includes('private_existing')) assert.ok(h.db.prepare("SELECT name FROM sqlite_master WHERE name='private_existing'").get());
    else assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 99);
    h.db.close();
  }
});
test('missing, malformed and version-inconsistent authority fails closed without reset', async () => {
  for (const sql of ["DELETE FROM repository", "UPDATE repository SET manifest='{'", 'UPDATE repository SET revision=2']) {
    const h = harness(); await h.factory().load(); h.db.exec(sql);
    await assert.rejects(h.factory().load()); h.db.close();
  }
});
test('unknown core schema, journal phases and malformed journal payloads fail closed', async () => {
  for (const corrupt of ['manifest', 'phase', 'request']) {
    const h = harness(); const s = h.factory(); await s.registerOperation(external());
    if (corrupt === 'manifest') { const m = await s.load(); m.schemaVersion = 99; h.db.prepare('UPDATE repository SET manifest=?').run(JSON.stringify(m)); }
    if (corrupt === 'phase') { h.db.exec("PRAGMA ignore_check_constraints=ON; UPDATE operations SET phase='invented'"); }
    if (corrupt === 'request') h.db.exec("UPDATE operations SET request='{}'");
    await assert.rejects(h.factory().load()); h.db.close();
  }
});
test('journal/manifest mismatch is detected', async () => {
  const h = harness(); const s = h.factory(); await s.applyMetadata(request());
  h.db.exec('DELETE FROM operations'); await assert.rejects(h.factory().load(), { code: 'journal_manifest_inconsistent' }); h.db.close();
});
test('recovery outcomes persist, repeat safely, distinguish blocked and retryable', async () => {
  const h = harness(); const s = h.factory(); await s.registerOperation(external());
  const input = { operationId: 'operation-one', expectedGeneration: 1, expectedRevision: 1, phase: 'blocked', code: 'adapter_unavailable' };
  const blocked = await s.recordRecovery(input); assert.equal(blocked.generation, 2);
  const repeated = await s.recordRecovery({ ...input, expectedGeneration: 2 }); assert.equal(repeated.generation, 2);
  const retry = await h.factory().recordRecovery({ ...input, expectedGeneration: 2, phase: 'retryable', code: 'retry_requested' });
  assert.equal(retry.attempts, 2); assert.equal((await s.listRecovery())[0].phase, 'retryable'); h.db.close();
});
test('stale recovery and terminal transitions reject without fabricated file success', async () => {
  const h = harness(); const s = h.factory(); await s.registerOperation(external());
  const input = { operationId: 'operation-one', expectedGeneration: 1, expectedRevision: 1, phase: 'failed', code: 'operation_failed' };
  await s.applyMetadata(request({ operationId: 'operation-two', idempotencyKey: 'request-two' }));
  assert.equal((await s.listRecovery())[0].resumable, false);
  await assert.rejects(s.recordRecovery(input), { code: 'stale_revision' });
  await s.recordRecovery({ ...input, expectedRevision: 2 }); assert.equal((await s.listRecovery()).length, 0);
  await assert.rejects(s.recordRecovery({ ...input, expectedRevision: 2 }), { code: 'stale_operation' });
  await assert.rejects(s.recordRecovery({ ...input, expectedRevision: 2, expectedGeneration: 2, phase: 'retryable' }), { code: 'invalid_transition' });
  await assert.rejects(s.recordRecovery({ ...input, phase: 'completed' }), { code: 'invalid_request' }); h.db.close();
});
test('recovery write failure rolls back generation and outcome', async () => {
  const h = harness(); const s = h.factory(); await s.registerOperation(external()); h.fault(sql => sql.startsWith('UPDATE operations'));
  const input = { operationId: 'operation-one', expectedGeneration: 1, expectedRevision: 1, phase: 'retryable', code: 'retry_requested' };
  await assert.rejects(s.recordRecovery(input)); h.fault(null);
  assert.equal((await s.listRecovery())[0].generation, 1); assert.equal((await s.recordRecovery(input)).generation, 2); h.db.close();
});
test('journal accepts no worksheet text, file facts or unauthorized core transitions', async () => {
  const h = harness(); const s = h.factory();
  await assert.rejects(s.registerOperation({ ...external(), worksheet: 'private' }), { code: 'invalid_request' });
  await assert.rejects(s.applyMetadata(request({ command: 'completeDeletion', args: ['asset', true] })), { code: 'invalid_request' });
  await assert.rejects(s.applyMetadata(request({ command: 'bind' })), { code: 'invalid_request' }); h.db.close();
});
test('independent connection sees no partial manifest before journal rollback', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fc-capture-visibility-'));
  let h; let observer;
  try {
    const file = path.join(directory, 'isolated.db'); h = harness(file); const s = h.factory(); await s.load();
    observer = new DatabaseSync(file); let observed = false;
    h.fault(sql => {
      if (!sql.startsWith('INSERT INTO operations')) return false;
      observed = true;
      assert.equal(observer.prepare('SELECT revision FROM repository').get().revision, 1);
      assert.equal(observer.prepare('SELECT count(*) AS n FROM operations').get().n, 0);
      return true;
    });
    await assert.rejects(s.applyMetadata(request())); assert.equal(observed, true);
    h.fault(null); assert.equal((await s.load()).revision, 1);
  } finally { observer?.close(); h?.db.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('missing schema objects in an existing versioned repository are not recreated', async () => {
  const h = harness(); await h.factory().load(); h.db.exec('DROP TABLE operations');
  await assert.rejects(h.factory().load(), { code: 'persistence_failed' });
  assert.equal(h.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='operations'").get().n, 0); h.db.close();
});
test('v1 metadata migration preserves committed authority and journal', async () => {
  const h = harness(); const s = h.factory(); await s.applyMetadata(request()); const before = await s.load();
  h.db.exec('DROP TABLE coordination_fences; DROP TABLE coordination_operations; DROP TABLE scope_binding; DROP TABLE adoptions; PRAGMA user_version=1');
  const restarted = h.factory(); assert.deepEqual(await restarted.load(), before);
  assert.equal((await restarted.inspect()).operations.length, 1); assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 3); h.db.close();
});
test('interrupted v1 migration leaves original records and version intact', async () => {
  const h = harness(); const s = h.factory(); await s.applyMetadata(request());
  h.db.exec('DROP TABLE coordination_fences; DROP TABLE coordination_operations; DROP TABLE scope_binding; DROP TABLE adoptions; PRAGMA user_version=1');
  h.fault(sql => sql.startsWith('ALTER TABLE operations'));
  await assert.rejects(h.factory().load()); h.fault(null);
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version, 1);
  assert.equal(h.db.prepare('SELECT revision FROM repository').get().revision, 2);
  assert.equal((await h.factory().load()).revision, 2); h.db.close();
});
