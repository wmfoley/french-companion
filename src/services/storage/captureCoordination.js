// INTERNAL capture-only foundation. Constructor identity provider is trusted composition,
// never route/request data. Household receipt evidence is reread by trusted composition.
const { sha256 } = require('@noble/hashes/sha2.js');
const Retirement = require('./captureRetirement');
const id = x => typeof x === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);
const integer = x => Number.isSafeInteger(x) && x >= 0;
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function exact(x, keys) {
  if (!x || Object.getPrototypeOf(x) !== Object.prototype || Object.keys(x).sort().join('|') !== keys.slice().sort().join('|')) fail('invalid_coordination');
}
function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  return x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
}
const encode = x => JSON.stringify(canonical(x));
const digest = x => Array.from(sha256(new TextEncoder().encode(encode(x))), b => b.toString(16).padStart(2, '0')).join('');
const KEYS = ['operationId', 'idempotencyKey', 'kind', 'assetId', 'assignmentId', 'sourceId', 'bindingId', 'expectedManifestRevision', 'expectedReferenceEpoch', 'householdRevisions', 'receiptOperationId'];
function request(r) {
  const retirement = r?.requestVersion === 2;
  exact(r, retirement ? [...KEYS, 'requestVersion', 'retirementEventId', 'originatingContentRevision', 'bindingFingerprint'] : KEYS);
  if (![r.operationId, r.idempotencyKey, r.assetId].every(id) || !['bind', 'retire', 'discover_delete'].includes(r.kind) ||
    !integer(r.expectedManifestRevision) || !r.expectedManifestRevision || !integer(r.expectedReferenceEpoch) || !Array.isArray(r.householdRevisions)) fail('invalid_coordination');
  if (r.kind === 'discover_delete' ? [r.assignmentId, r.sourceId, r.bindingId, r.receiptOperationId].some(x => x !== null) :
    ![r.assignmentId, r.sourceId, r.bindingId, r.receiptOperationId].every(id)) fail('invalid_coordination');
  let previous = '';
  for (const v of r.householdRevisions) {
    exact(v, ['assignmentId', 'contentRevision', 'writeRevision']);
    if (!id(v.assignmentId) || v.assignmentId <= previous || !integer(v.contentRevision) || !v.contentRevision || !integer(v.writeRevision)) fail('invalid_coordination');
    previous = v.assignmentId;
  }
  if (r.kind !== 'discover_delete' && !r.householdRevisions.some(v => v.assignmentId === r.assignmentId)) fail('invalid_coordination');
  if (retirement) Retirement.validateRequest(r);
}
const SCHEMA = `CREATE TABLE scope_binding(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL CHECK(version=1), installation_ref TEXT NOT NULL, generation INTEGER NOT NULL CHECK(generation>0), reference_epoch INTEGER NOT NULL CHECK(reference_epoch>=0));
CREATE TABLE coordination_operations(id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, state TEXT NOT NULL);
CREATE TABLE coordination_fences(asset_id TEXT PRIMARY KEY, operation_id TEXT NOT NULL UNIQUE REFERENCES coordination_operations(id), state TEXT NOT NULL CHECK(state='discovery'));
PRAGMA user_version=3;`;
async function readCoordination(tx, manifest, legacy = false) {
  for (const [table, columns] of [['scope_binding', ['id', 'version', 'installation_ref', 'generation', 'reference_epoch']],
    ['coordination_operations', ['id', 'idempotency_key', 'state']], ['coordination_fences', ['asset_id', 'operation_id', 'state']]]) {
    if ((await tx.getAllAsync(`PRAGMA table_info(${table})`)).map(c => c.name).join('|') !== columns.join('|')) fail('invalid_coordination');
  }
  const scopes = await tx.getAllAsync('SELECT * FROM scope_binding');
  if (scopes.length > 1) fail('invalid_coordination');
  const scope = scopes[0] || null;
  if (scope && (scope.id !== 1 || scope.version !== 1 || typeof scope.installation_ref !== 'string' || !scope.installation_ref ||
    scope.generation !== 1 || !integer(scope.reference_epoch))) fail('invalid_coordination');
  const rows = await tx.getAllAsync('SELECT * FROM coordination_operations ORDER BY id');
  const operations = rows.map(row => {
    let op; try { op = JSON.parse(row.state); } catch { fail('invalid_coordination'); }
    const retirement = op?.recordVersion === 3;
    exact(op, ['recordVersion', 'request', 'installationRef', 'fingerprint', 'reservationGeneration', 'ownerGeneration', 'owner', 'leaseUntil', 'phase', 'receiptState', 'createdAt', 'updatedAt', 'issuedAt', 'completedAt', 'errorCode', ...(retirement ? ['completion'] : [])]);
    request(op.request);
    if (retirement && (legacy || op.request.requestVersion !== 2 || op.request.kind !== 'retire' || op.phase !== 'complete' && op.completion !== null)) fail('invalid_coordination');
    if (!retirement && op.request.requestVersion !== undefined) fail('invalid_coordination');
    if (!scope || op.recordVersion !== (retirement ? 3 : op.phase === 'complete' ? 2 : 1) || row.id !== op.request.operationId || row.idempotency_key !== op.request.idempotencyKey ||
      op.installationRef !== scope.installation_ref || op.fingerprint !== digest({ installationRef: op.installationRef, request: op.request }) ||
      !integer(op.reservationGeneration) || op.reservationGeneration !== op.request.expectedReferenceEpoch + 1 || op.reservationGeneration > scope.reference_epoch ||
      op.request.expectedManifestRevision > manifest.revision || !manifest.assets.some(a => a.id === op.request.assetId) ||
      !integer(op.ownerGeneration) || !(op.owner === null ? op.ownerGeneration === 0 && op.leaseUntil === 0 : id(op.owner) && op.ownerGeneration > 0) ||
      !integer(op.leaseUntil) || !['reserved', 'blocked', 'complete'].includes(op.phase) ||
      !integer(op.createdAt) || !integer(op.updatedAt) || op.updatedAt < op.createdAt ||
      (op.phase === 'complete' ? op.request.kind !== (retirement ? 'retire' : 'bind') || op.receiptState !== 'applied' || !integer(op.issuedAt) || !integer(op.completedAt) || op.completedAt !== op.updatedAt || op.errorCode !== null :
        op.receiptState !== 'unknown' || op.issuedAt !== null || op.completedAt !== null ||
        (op.phase === 'reserved' ? op.errorCode !== null : !['receipt_unknown', 'storage_unavailable', 'reconciliation_required'].includes(op.errorCode))) || row.state !== encode(op)) fail('invalid_coordination');
    if (retirement) Retirement.bindingFor(manifest, op.request);
    if (op.phase === 'complete' && !retirement) {
      const binding = manifest.bindings.find(b => b.id === op.request.bindingId);
      if (!binding || binding.assetId !== op.request.assetId || binding.assignmentId !== op.request.assignmentId || binding.sourceId !== op.request.sourceId ||
        binding.contentRevision !== op.request.householdRevisions[0].contentRevision || manifest.revision <= op.request.expectedManifestRevision) fail('invalid_coordination');
    }
    return op;
  });
  const events = legacy ? [] : await Retirement.readEvents(tx, manifest, scope, operations);
  const positions = operations.flatMap(o => o.phase === 'complete' ? [o.reservationGeneration, o.reservationGeneration + 1] : [o.reservationGeneration]).sort((a, b) => a - b);
  if (positions.some((value, i) => value !== i + 1)) fail('invalid_coordination');
  if (new Set(operations.map(o => o.reservationGeneration)).size !== operations.length || (scope && scope.reference_epoch !== operations.length + operations.filter(o => o.phase === 'complete').length)) fail('invalid_coordination');
  const fences = await tx.getAllAsync('SELECT * FROM coordination_fences ORDER BY asset_id');
  for (const fence of fences) {
    const op = operations.find(o => o.request.operationId === fence.operation_id);
    if (fence.state !== 'discovery' || !op || op.request.kind !== 'discover_delete' || op.request.assetId !== fence.asset_id) fail('invalid_coordination');
  }
  if (operations.some(o => o.request.kind === 'discover_delete' && !fences.some(f => f.operation_id === o.request.operationId))) fail('invalid_coordination');
  return { scope, operations, fences, events };
}
function createCaptureCoordination({ transaction, trustedIdentity, now, persistBinding, prepareBinding }) {
  async function identity() {
    if (typeof trustedIdentity !== 'function') fail('identity_unavailable');
    const result = await trustedIdentity(); exact(result, ['installationRef']);
    if (typeof result.installationRef !== 'string' || !result.installationRef.trim() || result.installationRef.length > 256) fail('identity_unavailable');
    return result.installationRef;
  }
  function time() { const t = now(); if (!integer(t)) fail('invalid_time'); return t; }
  async function scoped(action) {
    return transaction(async (tx, state) => {
      const installation = await identity();
      const current = await readCoordination(tx, state.manifest);
      if (!current.scope) fail('scope_unbound');
      if (current.scope.installation_ref !== installation) fail('scope_mismatch');
      return action(tx, state, current);
    });
  }
  async function write(tx, op, previous) {
    const changed = await tx.runAsync('UPDATE coordination_operations SET state=? WHERE id=? AND state=?', encode(op), op.request.operationId, encode(previous));
    if (changed.changes !== 1) fail('stale_owner');
  }
  return Object.freeze({
    assertInstallation: installationRef => scoped(async (tx, state, current) => {
      if (current.scope.installation_ref !== installationRef) fail('scope_mismatch'); return true;
    }),
    bootstrap: async (...args) => {
      if (args.length) fail('invalid_coordination');
      return transaction(async (tx, state) => {
        const installation = await identity();
        const current = await readCoordination(tx, state.manifest);
        if (current.scope) { if (current.scope.installation_ref !== installation) fail('scope_mismatch'); return { generation: current.scope.generation, referenceEpoch: current.scope.reference_epoch }; }
        if (state.manifest.revision !== 1 || state.operations.length || state.manifest.captures.length) fail('unbound_repository_nonempty');
        await tx.runAsync('INSERT INTO scope_binding VALUES(1,1,?,1,0)', installation);
        return { generation: 1, referenceEpoch: 0 };
      });
    },
    inspect: () => scoped(async (tx, state, current) => ({ referenceEpoch: current.scope.reference_epoch, operations: current.operations, fences: current.fences })),
    retirementEvents: () => scoped(async (tx, state, current) => current.events),
    validateIssuance: (operationId, ownerGeneration, owner) => scoped(async (tx, state, current) => {
      const op = current.operations.find(o => o.request.operationId === operationId);
      if (!op || op.phase === 'complete' || op.ownerGeneration !== ownerGeneration || op.owner !== owner || op.leaseUntil <= time()) fail('stale_owner');
      if (op.request.expectedManifestRevision !== state.manifest.revision) fail('stale_revision');
      if (op.reservationGeneration !== current.scope.reference_epoch) fail('stale_epoch');
      if (current.fences.some(f => f.asset_id === op.request.assetId)) fail('asset_fenced');
      if (op.request.kind === 'retire') {
        if (op.recordVersion !== 3) fail('legacy_retirement_reconciliation_required');
        Retirement.bindingFor(state.manifest, op.request);
        if (current.events.some(e => e.bindingId === op.request.bindingId)) fail('already_retired');
      } else {
        if (op.request.kind !== 'bind') fail('invalid_coordination');
        prepareBinding(state.manifest, op); // Pure dry run: saved/verified asset and globally unique binding ID.
      }
      return true;
    }),
    reserve: async input => {
      request(input); const r = JSON.parse(encode(input));
      return scoped(async (tx, state, current) => {
        const prior = current.operations.find(o => o.request.operationId === r.operationId || o.request.idempotencyKey === r.idempotencyKey);
        const fingerprint = digest({ installationRef: current.scope.installation_ref, request: r });
        if (prior) {
          if (prior.request.kind === 'retire' && prior.recordVersion === 1) fail('legacy_retirement_reconciliation_required');
          if (prior.fingerprint !== fingerprint) fail('idempotency_conflict'); return { operation: prior, replayed: true };
        }
        if (r.kind === 'retire') {
          if (r.requestVersion !== 2) fail('legacy_retirement_reconciliation_required');
          if (current.operations.some(o => o.request.kind === 'retire' && o.request.bindingId === r.bindingId && o.recordVersion === 1)) fail('legacy_retirement_reconciliation_required');
          if (current.events.some(e => e.bindingId === r.bindingId)) fail('already_retired');
          Retirement.bindingFor(state.manifest, r);
          if (current.operations.some(o => o.request.retirementEventId === r.retirementEventId) || current.events.some(e => e.eventId === r.retirementEventId)) fail('reference_conflict');
        }
        if (state.operations.some(o => o.id === r.operationId || o.idempotency_key === r.idempotencyKey)) fail('idempotency_conflict');
        if (r.kind !== 'discover_delete' && current.operations.some(o => o.request.receiptOperationId === r.receiptOperationId ||
          o.request.kind === r.kind && o.request.bindingId === r.bindingId)) fail('reference_conflict');
        if (r.expectedManifestRevision !== state.manifest.revision) fail('stale_revision');
        if (r.expectedReferenceEpoch !== current.scope.reference_epoch) fail('stale_epoch');
        if (!state.manifest.assets.some(a => a.id === r.assetId)) fail('asset_not_found');
        if (r.kind === 'bind' && (!state.manifest.availability.some(a => a.id === r.assetId && a.status === 'available' && a.integrity !== 'corrupt') ||
          state.manifest.bindings.some(b => b.id === r.bindingId))) fail('invalid_target');
        if (r.kind === 'retire' && !state.manifest.bindings.some(b => b.id === r.bindingId && b.assetId === r.assetId && b.assignmentId === r.assignmentId && b.sourceId === r.sourceId)) fail('invalid_target');
        if (current.fences.some(f => f.asset_id === r.assetId)) fail('asset_fenced');
        const t = time(); const nextEpoch = current.scope.reference_epoch + 1;
        if (!integer(nextEpoch)) fail('invalid_time');
        const changed = await tx.runAsync('UPDATE scope_binding SET reference_epoch=? WHERE id=1 AND reference_epoch=? AND EXISTS(SELECT 1 FROM repository WHERE id=1 AND revision=?)', nextEpoch, r.expectedReferenceEpoch, r.expectedManifestRevision);
        if (changed.changes !== 1) fail('stale_epoch');
        const op = { recordVersion: r.requestVersion === 2 ? 3 : 1, request: r, installationRef: current.scope.installation_ref, fingerprint, reservationGeneration: nextEpoch,
          ownerGeneration: 0, owner: null, leaseUntil: 0, phase: 'reserved', receiptState: 'unknown', createdAt: t, updatedAt: t, issuedAt: null, completedAt: null, errorCode: null };
        if (op.recordVersion === 3) op.completion = null;
        await tx.runAsync('INSERT INTO coordination_operations VALUES(?,?,?)', r.operationId, r.idempotencyKey, encode(op));
        if (r.kind === 'discover_delete') await tx.runAsync("INSERT INTO coordination_fences VALUES(?,?,'discovery')", r.assetId, r.operationId);
        await readCoordination(tx, state.manifest); return { operation: op, replayed: false };
      });
    },
    claim: (operationId, expectedOwnerGeneration, owner) => scoped(async (tx, state, current) => {
      if (!id(operationId) || !integer(expectedOwnerGeneration) || !id(owner)) fail('invalid_coordination');
      const old = current.operations.find(o => o.request.operationId === operationId);
      if (old?.request.kind === 'retire' && old.recordVersion === 1) fail('legacy_retirement_reconciliation_required');
      if (!old || old.ownerGeneration !== expectedOwnerGeneration) fail('stale_owner');
      if (old.phase === 'complete') fail('invalid_coordination');
      const t = time(); if (t < old.updatedAt) fail('invalid_time');
      if (old.owner !== null && old.leaseUntil > t) fail('operation_busy');
      const op = { ...old, owner, ownerGeneration: old.ownerGeneration + 1, leaseUntil: t + 60000, updatedAt: t };
      if (!integer(op.leaseUntil) || !integer(op.ownerGeneration)) fail('invalid_time');
      await write(tx, op, old); return op;
    }),
    block: (operationId, ownerGeneration, owner, code) => scoped(async (tx, state, current) => {
      if (!['receipt_unknown', 'storage_unavailable', 'reconciliation_required'].includes(code)) fail('invalid_coordination');
      const old = current.operations.find(o => o.request.operationId === operationId); const t = time();
      if (old?.phase === 'complete') fail('invalid_coordination');
      if (!old || old.owner !== owner || old.ownerGeneration !== ownerGeneration || old.leaseUntil <= t) fail('stale_owner');
      if (t < old.updatedAt) fail('invalid_time');
      const op = { ...old, phase: 'blocked', errorCode: code, updatedAt: t };
      await write(tx, op, old); return op;
    }),
    // Both functions are privileged injected closures, never serialized receipt claims.
    commitBinding: (operationId, ownerGeneration, owner, verifyReceipt, guard) => scoped(async (tx, state, current) => {
      if (typeof verifyReceipt !== 'function' || typeof guard !== 'function') fail('invalid_coordination');
      guard(); const old = current.operations.find(o => o.request.operationId === operationId);
      if (!old || old.request.kind !== 'bind' || old.request.householdRevisions.length !== 1) fail('invalid_coordination');
      const receipt = await verifyReceipt(JSON.parse(encode(old)));
      const expected = receiptRequest(old);
      if (!receipt || receipt.version !== 1 || receipt.outcome !== 'applied' || !integer(receipt.sequence) || !receipt.sequence ||
        receipt.operation_id !== expected.operationId || receipt.idempotency_key !== expected.idempotencyKey || receipt.installation_ref !== old.installationRef ||
        receipt.request_json !== encode(expected) || receipt.request_fingerprint !== digest(expected) ||
        receipt.content_revision !== expected.expectedContentRevision || receipt.write_revision !== expected.expectedWriteRevision || !integer(receipt.committed_at)) fail('receipt_mismatch');
      guard();
      if (old.phase === 'complete') return { bindingId: old.request.bindingId, replayed: true };
      const t = time();
      if (old.owner !== owner || old.ownerGeneration !== ownerGeneration || old.leaseUntil <= t) fail('stale_owner');
      if (t < old.updatedAt) fail('invalid_time');
      if (state.manifest.revision !== old.request.expectedManifestRevision) fail('stale_revision');
      if (current.scope.reference_epoch !== old.reservationGeneration) fail('stale_epoch');
      if (current.fences.some(f => f.asset_id === old.request.assetId)) fail('asset_fenced');
      // No await between final authorization/lease validation and first durable write.
      guard();
      const next = await persistBinding(tx, state, old);
      const changed = await tx.runAsync('UPDATE scope_binding SET reference_epoch=reference_epoch+1 WHERE id=1 AND reference_epoch=?', old.reservationGeneration);
      if (changed.changes !== 1) fail('stale_epoch');
      const op = { ...old, recordVersion: 2, phase: 'complete', receiptState: 'applied', issuedAt: receipt.committed_at, completedAt: t, updatedAt: t, errorCode: null };
      await write(tx, op, old); await readCoordination(tx, next);
      return { bindingId: old.request.bindingId, replayed: false };
    }),
    commitRetirement: (operationId, ownerGeneration, owner, verifyReceipt, guard) => scoped(async (tx, state, current) => {
      if (typeof guard !== 'function' || typeof verifyReceipt !== 'function') fail('invalid_coordination');
      guard(); const old = current.operations.find(o => o.request.operationId === operationId);
      if (!old || old.recordVersion !== 3 || old.request.kind !== 'retire') fail('invalid_coordination');
      Retirement.bindingFor(state.manifest, old.request);
      const receipt = await verifyReceipt(JSON.parse(encode(old))); const expected = receiptRequest(old);
      if (!receipt || receipt.version !== 1 || receipt.outcome !== 'applied' || !integer(receipt.sequence) || !receipt.sequence ||
        receipt.operation_id !== expected.operationId || receipt.idempotency_key !== expected.idempotencyKey || receipt.installation_ref !== old.installationRef ||
        receipt.request_json !== encode(expected) || receipt.request_fingerprint !== digest(expected) ||
        receipt.content_revision !== expected.expectedContentRevision || receipt.write_revision !== expected.expectedWriteRevision || !integer(receipt.committed_at)) fail('receipt_mismatch');
      guard();
      if (old.phase === 'complete') {
        const event = current.events.find(e => e.operationId === operationId);
        if (!event || event.receiptSequence !== receipt.sequence || event.receiptFingerprint !== receipt.request_fingerprint || old.issuedAt !== receipt.committed_at) fail('receipt_mismatch');
        return { event, replayed: true };
      }
      const t = time();
      if (old.owner !== owner || old.ownerGeneration !== ownerGeneration || old.leaseUntil <= t) fail('stale_owner');
      if (t < old.updatedAt) fail('invalid_time');
      if (state.manifest.revision !== old.request.expectedManifestRevision) fail('stale_revision');
      if (current.scope.reference_epoch !== old.reservationGeneration) fail('stale_epoch');
      if (current.fences.some(f => f.asset_id === old.request.assetId)) fail('asset_fenced');
      if (current.events.some(e => e.bindingId === old.request.bindingId)) fail('already_retired');
      const event = Retirement.makeEvent(old, receipt, t);
      if (!integer(event.committedReferenceEpoch)) fail('invalid_time');
      guard();
      const changed = await tx.runAsync('UPDATE scope_binding SET reference_epoch=? WHERE id=1 AND installation_ref=? AND generation=1 AND reference_epoch=? AND EXISTS(SELECT 1 FROM repository WHERE id=1 AND revision=?)',
        event.committedReferenceEpoch, old.installationRef, old.reservationGeneration, old.request.expectedManifestRevision);
      if (changed.changes !== 1) fail('stale_epoch');
      await Retirement.insert(tx, event);
      const op = { ...old, phase: 'complete', receiptState: 'applied', issuedAt: receipt.committed_at, completedAt: t, updatedAt: t, errorCode: null, completion: Retirement.completion(event) };
      await write(tx, op, old); await readCoordination(tx, state.manifest);
      return { event, replayed: false };
    }),
  });
}
function receiptRequest(op) {
  const r = op.request; const revision = r.householdRevisions[0];
  if (r.kind === 'retire' && (r.requestVersion !== 2 || op.recordVersion !== 3)) fail('legacy_retirement_reconciliation_required');
  if (r.kind === 'retire') return Retirement.receiptRequest(op);
  return { operationId: r.receiptOperationId, idempotencyKey: r.idempotencyKey, kind: 'create_binding', installationRef: op.installationRef,
    assetId: r.assetId, bindingId: r.bindingId, assignmentId: r.assignmentId, sourceId: r.sourceId, originatingContentRevision: revision.contentRevision,
    expectedContentRevision: revision.contentRevision, expectedWriteRevision: revision.writeRevision, referenceEpoch: r.expectedReferenceEpoch,
    reservationGeneration: op.reservationGeneration, payloadDigest: null };
}
module.exports = { SCHEMA, readCoordination, createCaptureCoordination, receiptRequest };
