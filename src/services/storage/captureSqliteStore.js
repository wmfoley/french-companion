const Core = require('../../core/capture/captureRepositoryCore');
const Coordination = require('./captureCoordination');
const DATABASE_NAME = 'french-companion-captures-v1.db';
const id = x => typeof x === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);
const number = x => Number.isSafeInteger(x) && x >= 0;
const clone = x => JSON.parse(JSON.stringify(x));
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function exact(x, keys) {
  if (!x || Object.getPrototypeOf(x) !== Object.prototype || Object.keys(x).sort().join('|') !== keys.slice().sort().join('|')) fail('invalid_request');
}
function requestCheck(r) {
  exact(r, ['operationId', 'idempotencyKey', 'expectedRevision', 'type', 'command', 'args', 'captureId', 'assetId']);
  if (![r.operationId, r.idempotencyKey].every(id) || !number(r.expectedRevision) || !r.expectedRevision ||
    ![r.captureId, r.assetId].every(x => x === null || id(x)) || !Array.isArray(r.args)) fail('invalid_request');
  if (r.type === 'metadata') {
    if (r.captureId !== null || r.assetId !== null || !['createCapture', 'save', 'reorder', 'observe'].includes(r.command)) fail('invalid_request');
    if (r.command === 'observe') {
      if (r.args.length !== 3 || !id(r.args[0]) || !['available', 'unexpectedly_missing'].includes(r.args[1]) || !['verified', 'unknown', 'corrupt'].includes(r.args[2])) fail('invalid_request');
      return;
    }
    if (r.command === 'createCapture' ? r.args.length !== 0 : !id(r.args[0]) ||
      (r.command === 'save' ? r.args.length !== 1 : r.args.length !== 2 || !Array.isArray(r.args[1]) || !r.args[1].every(id))) fail('invalid_request');
  } else if (!['adoption', 'deletion', 'cleanup'].includes(r.type) || r.command !== null || r.args.length ||
    (r.type === 'deletion' ? !id(r.assetId) : !id(r.captureId))) fail('invalid_request');
}
function canonicalRequest(r) {
  requestCheck(r);
  return JSON.stringify(['operationId', 'idempotencyKey', 'expectedRevision', 'type', 'command', 'args', 'captureId', 'assetId'].map(k => r[k]));
}
const SCHEMA = `
CREATE TABLE repository (id INTEGER PRIMARY KEY CHECK(id=1), schema_version INTEGER NOT NULL CHECK(schema_version=1), revision INTEGER NOT NULL CHECK(revision>0), manifest TEXT NOT NULL);
CREATE TABLE operations (id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, type TEXT NOT NULL CHECK(type IN ('metadata','adoption','deletion','cleanup')), request TEXT NOT NULL, phase TEXT NOT NULL CHECK(phase IN ('pending','retryable','blocked','failed','completed')), generation INTEGER NOT NULL CHECK(generation>0), created_at INTEGER NOT NULL CHECK(created_at>=0), updated_at INTEGER NOT NULL CHECK(updated_at>=created_at), attempts INTEGER NOT NULL CHECK(attempts>=0), error_code TEXT, committed_revision INTEGER UNIQUE, CHECK((type='metadata' AND phase='completed' AND committed_revision IS NOT NULL) OR (type!='metadata' AND phase!='completed' AND committed_revision IS NULL)));
CREATE INDEX operations_recovery ON operations(phase,id);
PRAGMA user_version=1;`;

/** Inject an Expo-SQLite-shaped database. Not connected to application startup or UI. */
function createCaptureSqliteStore({ openDatabase, newId, now, trustedInstallationIdentity, onCoordinationReady }) {
  if (![openDatabase, newId, now].every(fn => typeof fn === 'function')) fail('invalid_dependencies');
  let opening;
  function time() { const t = now(); if (!number(t)) fail('invalid_time'); return t; }
  async function read(tx) {
    const row = await tx.getFirstAsync('SELECT * FROM repository WHERE id=1');
    if (!row || row.schema_version !== 1) fail('invalid_repository');
    let manifest;
    try { manifest = Core.deserialize(row.manifest); } catch { fail('invalid_manifest'); }
    if (row.revision !== manifest.revision || row.manifest !== Core.serialize(manifest)) fail('revision_inconsistent');
    const rows = await tx.getAllAsync('SELECT * FROM operations ORDER BY id');
    const operations = rows.map(row => {
      let request;
      try {
        const values = JSON.parse(row.request);
        if (!Array.isArray(values) || values.length !== 8) fail('invalid_journal');
        request = Object.fromEntries(['operationId', 'idempotencyKey', 'expectedRevision', 'type', 'command', 'args', 'captureId', 'assetId'].map((k, i) => [k, values[i]]));
        if (canonicalRequest(request) !== row.request) fail('invalid_journal');
      } catch { fail('invalid_journal'); }
      if (row.id !== request.operationId || row.idempotency_key !== request.idempotencyKey || row.type !== request.type ||
        !['pending', 'retryable', 'blocked', 'failed', 'completed'].includes(row.phase) ||
        !number(row.generation) || !row.generation || !number(row.attempts) || !number(row.created_at) ||
        !number(row.updated_at) || row.updated_at < row.created_at ||
        ![null, 'retry_requested', 'adapter_unavailable', 'revision_conflict', 'reconciliation_required', 'operation_failed'].includes(row.error_code) ||
        (row.type === 'metadata' ? row.phase !== 'completed' || row.committed_revision !== request.expectedRevision + 1 || row.committed_revision > manifest.revision :
          row.type === 'adoption' && row.phase === 'completed' ? row.committed_revision !== request.expectedRevision + 1 || row.committed_revision > manifest.revision :
            row.phase === 'completed' || row.committed_revision !== null)) fail('invalid_journal');
      return { ...row, request };
    });
    const adoptions = await tx.getAllAsync('SELECT id,state FROM adoptions ORDER BY id');
    for (const row of adoptions) {
      const op = operations.find(o => o.id === row.id && o.type === 'adoption');
      let state; try { state = JSON.parse(row.state); } catch { fail('invalid_adoption'); }
      validateAdoption(state);
      if (!op || state.input.captureId !== op.request.captureId || (state.phase === 'completed') !== (op.phase === 'completed')) fail('invalid_adoption');
      if (state.phase === 'completed') {
        const asset = manifest.assets.find(a => a.id === state.assetId);
        if (!asset || asset.sha256 !== state.digest || asset.pageId !== state.pageId || asset.bytes !== state.bytes) fail('invalid_adoption');
      }
    }
    if (operations.some(o => o.type === 'adoption' && o.phase === 'completed' && !adoptions.some(a => a.id === o.id))) fail('invalid_adoption');
    const commits = operations.filter(o => o.committed_revision !== null).map(o => o.committed_revision).sort((a, b) => a - b);
    if (commits.length !== manifest.revision - 1 || commits.some((r, i) => r !== i + 2)) fail('journal_manifest_inconsistent');
    return { manifest, operations };
  }
  async function open() {
    if (!opening) opening = (async () => {
      const db = await openDatabase(DATABASE_NAME);
      await db.withExclusiveTransactionAsync(async tx => {
        const version = (await tx.getFirstAsync('PRAGMA user_version')).user_version;
        if (version === 0) {
          const tables = await tx.getAllAsync("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'");
          if (tables.length) fail('unversioned_repository');
          await tx.execAsync(SCHEMA);
          const m = Core.emptyManifest();
          await tx.runAsync('INSERT INTO repository(id,schema_version,revision,manifest) VALUES(1,1,?,?)', m.revision, Core.serialize(m));
        } else if (![1, 2, 3].includes(version)) fail('unsupported_database_version');
        // v1 -> v2 changes only this isolated capture DB; preserve its journal.
        if (version === 0 || version === 1) {
          await tx.execAsync(`ALTER TABLE operations RENAME TO operations_v1;
            CREATE TABLE operations (id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, type TEXT NOT NULL CHECK(type IN ('metadata','adoption','deletion','cleanup')), request TEXT NOT NULL, phase TEXT NOT NULL CHECK(phase IN ('pending','retryable','blocked','failed','completed')), generation INTEGER NOT NULL CHECK(generation>0), created_at INTEGER NOT NULL CHECK(created_at>=0), updated_at INTEGER NOT NULL CHECK(updated_at>=created_at), attempts INTEGER NOT NULL CHECK(attempts>=0), error_code TEXT, committed_revision INTEGER UNIQUE);
            INSERT INTO operations SELECT * FROM operations_v1;
            DROP TABLE operations_v1;
            CREATE INDEX operations_recovery ON operations(phase,id);
            CREATE TABLE adoptions (id TEXT PRIMARY KEY REFERENCES operations(id), state TEXT NOT NULL);
            PRAGMA user_version=2;`);
        }
        const current = await read(tx);
        if (version !== 3) {
          const existing = await tx.getAllAsync("SELECT name FROM sqlite_master WHERE name IN ('scope_binding','coordination_operations','coordination_fences')");
          if (existing.length) fail('invalid_coordination');
          await tx.execAsync(Coordination.SCHEMA);
        }
        await Coordination.readCoordination(tx, current.manifest);
      });
      return db;
    })().catch(e => { opening = null; throw e; });
    return opening;
  }
  async function transaction(action) {
    try {
      const db = await open(); let result;
      await db.withExclusiveTransactionAsync(async tx => {
        if ((await tx.getFirstAsync('PRAGMA user_version')).user_version !== 3) fail('unsupported_database_version');
        const current = await read(tx);
        await Coordination.readCoordination(tx, current.manifest);
        result = await action(tx, current);
      });
      return clone(result);
    } catch (e) { if (typeof e.code === 'string' && !e.code.startsWith('ERR_')) throw e; fail('persistence_failed'); }
  }
  function replay(state, request, payload) {
    const sameKey = state.operations.find(o => o.idempotency_key === request.idempotencyKey);
    const sameId = state.operations.find(o => o.id === request.operationId);
    if (sameKey || sameId) {
      const old = sameKey || sameId;
      if (old.request.operationId !== request.operationId || canonicalRequest(old.request) !== payload) fail('idempotency_conflict');
      return { manifest: state.manifest, operation: old, replayed: true };
    }
    if (request.expectedRevision !== state.manifest.revision) fail('stale_revision');
    return null;
  }
  async function insert(tx, r, payload, phase, committedRevision) {
    const t = time();
    await tx.runAsync('INSERT INTO operations(id,idempotency_key,type,request,phase,generation,created_at,updated_at,attempts,error_code,committed_revision) VALUES(?,?,?,?,?,1,?,?,0,NULL,?)',
      r.operationId, r.idempotencyKey, r.type, payload, phase, t, t, committedRevision);
  }
  onCoordinationReady?.(Coordination.createCaptureCoordination({ transaction, trustedIdentity: trustedInstallationIdentity, now }));
  return {
    recordImageObservation: (operationId, expectedRevision, assetId, observation) => transaction(async (tx, s) => {
      exact(observation, ['status', 'integrity']);
      const request = { operationId, idempotencyKey: operationId, expectedRevision, type: 'metadata', command: 'observe', args: [assetId, observation.status, observation.integrity], captureId: null, assetId: null };
      const payload = canonicalRequest(request); const old = replay(s, request, payload); if (old) return old;
      const current = s.manifest.availability.find(a => a.id === assetId);
      if (!current) fail('asset_not_found');
      if (current.status === observation.status && current.integrity === observation.integrity) return { manifest: s.manifest };
      const core = Core.createRepositoryCore({ now, newId });
      const next = core.observe(s.manifest, expectedRevision, assetId, observation.status, observation.integrity);
      const changed = await tx.runAsync('UPDATE repository SET revision=?,manifest=? WHERE id=1 AND revision=?', next.revision, Core.serialize(next), expectedRevision);
      if (changed.changes !== 1) fail('stale_revision');
      await insert(tx, request, payload, 'completed', next.revision); await read(tx); return { manifest: next };
    }),
    reserveAdoption: async (request, input) => {
      requestCheck(request); validateInput(input);
      const r = clone(request); const payload = canonicalRequest(r);
      if (r.type !== 'adoption' || r.captureId !== input.captureId || r.assetId !== null) fail('invalid_request');
      return transaction(async (tx, s) => {
        const old = replay(s, r, payload);
        if (old) {
          const row = await tx.getFirstAsync('SELECT state FROM adoptions WHERE id=?', r.operationId);
          if (!row) fail('idempotency_conflict');
          const state = JSON.parse(row.state);
          if (['captureId', 'sourceUri', 'method', 'width', 'height', 'mime'].some(k => state.input[k] !== input[k])) fail('idempotency_conflict');
          return state;
        }
        const capture = s.manifest.captures.find(c => c.id === input.captureId);
        if (!capture || capture.status !== 'draft' || capture.pageIds.length >= 20 ||
          (s.manifest.cleanupIntents || []).some(i => i.captureId === capture.id)) fail('invalid_transition');
        const reservations = await tx.getAllAsync('SELECT state FROM adoptions');
        if (capture.pageIds.length + reservations.filter(row => { const a = JSON.parse(row.state); return a.input.captureId === capture.id && a.phase !== 'completed'; }).length >= 20) fail('page_limit');
        const used = new Set([...s.manifest.captures, ...s.manifest.pages, ...s.manifest.assets, ...s.manifest.bindings, ...s.manifest.intents].map(x => x.id));
        for (const row of reservations) { const a = JSON.parse(row.state); used.add(a.assetId); used.add(a.pageId); }
        function identity() { const value = newId(); if (!id(value) || used.has(value)) fail('duplicate_identity'); used.add(value); return value; }
        const state = { input: clone(input), assetId: identity(), pageId: identity(), phase: 'reserved', digest: null, bytes: null, owner: null, stagingOwner: null, leaseUntil: 0 };
        await insert(tx, r, payload, 'pending', null);
        await tx.runAsync('INSERT INTO adoptions(id,state) VALUES(?,?)', r.operationId, JSON.stringify(state));
        return state;
      });
    },
    adoptionState: operationId => transaction(async tx => {
      const row = await tx.getFirstAsync('SELECT state FROM adoptions WHERE id=?', operationId);
      if (!row) fail('operation_not_found'); return JSON.parse(row.state);
    }),
    claimAdoption: (operationId, owner) => transaction(async (tx, s) => {
      if (!id(owner)) fail('invalid_request');
      if (s.operations.find(o => o.id === operationId)?.phase === 'failed') fail('invalid_transition');
      const row = await tx.getFirstAsync('SELECT state FROM adoptions WHERE id=?', operationId);
      if (!row) fail('operation_not_found'); const state = JSON.parse(row.state);
      if (state.phase === 'completed') return state;
      const t = time(); if (state.owner && state.leaseUntil > t) fail('operation_busy');
      state.owner = owner; state.leaseUntil = t + 60000;
      await tx.runAsync('UPDATE adoptions SET state=? WHERE id=?', JSON.stringify(state), operationId); return state;
    }),
    checkpointAdoption: (operationId, owner, phase, facts = {}) => transaction(async (tx, s) => {
      const row = await tx.getFirstAsync('SELECT state FROM adoptions WHERE id=?', operationId);
      if (!row) fail('operation_not_found'); const state = JSON.parse(row.state);
      if (state.owner !== owner || state.leaseUntil <= time()) fail('ownership_lost');
      const allowed = { reserved: ['hashed'], hashed: ['finalized'], finalized: ['completed'] };
      if (!allowed[state.phase]?.includes(phase)) fail('invalid_transition');
      if (phase === 'hashed') { exact(facts, ['digest', 'bytes']); state.digest = facts.digest; state.bytes = facts.bytes; state.stagingOwner = owner; }
      else exact(facts, []);
      state.phase = phase; state.leaseUntil = time() + 60000; validateAdoption(state);
      if (phase === 'completed') {
        const op = s.operations.find(o => o.id === operationId);
        if (s.manifest.revision !== op.request.expectedRevision) fail('stale_revision');
        const names = [state.pageId, state.assetId];
        const core = Core.createRepositoryCore({ now, newId: () => names.shift() });
        const next = core.addPage(s.manifest, s.manifest.revision, state.input.captureId,
          { method: state.input.method, width: state.input.width, height: state.input.height, mime: state.input.mime, bytes: state.bytes, sha256: state.digest });
        const result = await tx.runAsync('UPDATE repository SET revision=?,manifest=? WHERE id=1 AND revision=?', next.revision, Core.serialize(next), s.manifest.revision);
        if (result.changes !== 1) fail('stale_revision');
        await tx.runAsync("UPDATE operations SET phase='completed',committed_revision=?,updated_at=?,generation=generation+1 WHERE id=?", next.revision, time(), operationId);
      }
      await tx.runAsync('UPDATE adoptions SET state=? WHERE id=?', JSON.stringify(state), operationId);
      await read(tx); return state;
    }),
    releaseAdoption: (operationId, owner) => transaction(async tx => {
      const row = await tx.getFirstAsync('SELECT state FROM adoptions WHERE id=?', operationId);
      if (!row) fail('operation_not_found'); const state = JSON.parse(row.state);
      if (state.owner !== owner) fail('ownership_lost'); state.owner = null; state.leaseUntil = 0;
      await tx.runAsync('UPDATE adoptions SET state=? WHERE id=?', JSON.stringify(state), operationId); return state;
    }),
    load: () => transaction(async (tx, s) => s.manifest),
    applyMetadata: async request => {
      requestCheck(request);
      const r = clone(request); const payload = canonicalRequest(r); if (r.type !== 'metadata' || r.command === 'observe') fail('invalid_request');
      return transaction(async (tx, s) => {
        const old = replay(s, r, payload); if (old) return old;
        const core = Core.createRepositoryCore({ now, newId: () => {
          const next = newId(); if (s.operations.some(o => o.id === next) || next === r.operationId) fail('duplicate_identity'); return next;
        } });
        const next = core[r.command](s.manifest, r.expectedRevision, ...r.args);
        const serialized = Core.serialize(next);
        const written = await tx.runAsync('UPDATE repository SET revision=?,manifest=? WHERE id=1 AND revision=?', next.revision, serialized, r.expectedRevision);
        if (written.changes !== 1) fail('stale_revision');
        await insert(tx, r, payload, 'completed', next.revision);
        const committed = await read(tx);
        return { manifest: committed.manifest, operation: committed.operations.find(o => o.id === r.operationId), replayed: false };
      });
    },
    registerOperation: async request => {
      requestCheck(request);
      const r = clone(request); const payload = canonicalRequest(r); if (r.type === 'metadata') fail('invalid_request');
      return transaction(async (tx, s) => {
        const old = replay(s, r, payload); if (old) return old;
        await insert(tx, r, payload, 'pending', null);
        const next = await read(tx);
        return { manifest: next.manifest, operation: next.operations.find(o => o.id === r.operationId), replayed: false };
      });
    },
    listRecovery: () => transaction(async (tx, s) => s.operations.filter(o => !['completed', 'failed'].includes(o.phase)).map(o =>
      ({ ...o, resumable: o.request.expectedRevision === s.manifest.revision, requiresAdapter: true }))),
    recordRecovery: async input => {
      exact(input, ['operationId', 'expectedGeneration', 'expectedRevision', 'phase', 'code']);
      const r = clone(input);
      exact(r, ['operationId', 'expectedGeneration', 'expectedRevision', 'phase', 'code']);
      if (!id(r.operationId) || !number(r.expectedGeneration) || !['retryable', 'blocked', 'failed'].includes(r.phase) ||
        !['retry_requested', 'adapter_unavailable', 'revision_conflict', 'reconciliation_required', 'operation_failed'].includes(r.code)) fail('invalid_request');
      return transaction(async (tx, s) => {
        if (s.manifest.revision !== r.expectedRevision) fail('stale_revision');
        const op = s.operations.find(o => o.id === r.operationId);
        if (!op || op.generation !== r.expectedGeneration) fail('stale_operation');
        if (op.phase === r.phase && op.error_code === r.code) return op;
        if (['failed', 'completed'].includes(op.phase)) fail('invalid_transition');
        const t = time(); if (t < op.updated_at) fail('invalid_time');
        const changed = await tx.runAsync('UPDATE operations SET phase=?,generation=generation+1,updated_at=?,attempts=attempts+1,error_code=? WHERE id=? AND generation=?',
          r.phase, t, r.code, r.operationId, r.expectedGeneration);
        if (changed.changes !== 1) fail('stale_operation');
        return (await read(tx)).operations.find(o => o.id === r.operationId);
      });
    },
    inspect: () => transaction(async (tx, s) => s),
  };
}
module.exports = { createCaptureSqliteStore, DATABASE_NAME };

function validateInput(input) {
  exact(input, ['captureId', 'sourceUri', 'method', 'width', 'height', 'mime']);
  if (!id(input.captureId) || typeof input.sourceUri !== 'string' || !input.sourceUri.startsWith('file://') ||
    !['camera', 'document_scanner'].includes(input.method) || ![input.width, input.height].every(x => number(x) && x > 0) ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(input.mime)) fail('invalid_request');
}
function validateAdoption(s) {
  exact(s, ['input', 'assetId', 'pageId', 'phase', 'digest', 'bytes', 'owner', 'stagingOwner', 'leaseUntil']); validateInput(s.input);
  if (![s.assetId, s.pageId].every(id) || s.assetId === s.pageId || !['reserved', 'hashed', 'finalized', 'completed'].includes(s.phase) ||
    !(s.owner === null || id(s.owner)) || !(s.phase === 'reserved' ? s.stagingOwner === null : id(s.stagingOwner)) || !number(s.leaseUntil) ||
    (s.phase === 'reserved' ? s.digest !== null || s.bytes !== null : typeof s.digest !== 'string' || !/^[a-f0-9]{64}$/.test(s.digest) || !number(s.bytes) || s.bytes <= 0)) fail('invalid_adoption');
}
