const { sha256 } = require('@noble/hashes/sha2.js');
const { validateAssignmentDocument, getWriteRevision } = require('../../core/assignments/assignmentDocument');
const { validPolicy } = require('../../core/assignments/practiceEligibility');
function fail(code) { const e = new Error(code); e.code = code; throw e; }
const id = x => typeof x === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);
const integer = x => Number.isSafeInteger(x) && x >= 0;
const copy = x => JSON.parse(JSON.stringify(x));
function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])]));
  return x;
}
function fingerprint(x) {
  return Array.from(sha256(new TextEncoder().encode(JSON.stringify(canonical(x)))), b => b.toString(16).padStart(2, '0')).join('');
}
const KEYS = ['operationId', 'idempotencyKey', 'kind', 'installationRef', 'assetId', 'bindingId', 'assignmentId', 'sourceId',
  'originatingContentRevision', 'expectedContentRevision', 'expectedWriteRevision', 'referenceEpoch', 'reservationGeneration', 'payloadDigest'];
function validateRequest(r) {
  if (!r || Object.getPrototypeOf(r) !== Object.prototype || Object.keys(r).sort().join('|') !== KEYS.slice().sort().join('|') ||
    ![r.operationId, r.idempotencyKey, r.assetId, r.bindingId, r.assignmentId, r.sourceId].every(id) ||
    typeof r.installationRef !== 'string' || !r.installationRef || !['create_binding', 'retire_binding'].includes(r.kind) ||
    !integer(r.originatingContentRevision) || !r.originatingContentRevision || !integer(r.referenceEpoch) ||
    !integer(r.reservationGeneration) || !r.reservationGeneration ||
    !(r.expectedContentRevision === null && r.expectedWriteRevision === null || integer(r.expectedContentRevision) && r.expectedContentRevision > 0 && integer(r.expectedWriteRevision)) ||
    !(r.payloadDigest === null || typeof r.payloadDigest === 'string' && /^[a-f0-9]{64}$/.test(r.payloadDigest))) fail('invalid_receipt_request');
}
const SCHEMA = `CREATE TABLE household_reference_meta(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL CHECK(version=1));
CREATE TABLE household_reference_receipts(sequence INTEGER PRIMARY KEY AUTOINCREMENT, version INTEGER NOT NULL CHECK(version=1), operation_id TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE, installation_ref TEXT NOT NULL, request_json TEXT NOT NULL, request_fingerprint TEXT NOT NULL, content_revision INTEGER NOT NULL CHECK(content_revision>0), write_revision INTEGER NOT NULL CHECK(write_revision>=0), committed_at INTEGER NOT NULL CHECK(committed_at>=0), outcome TEXT NOT NULL CHECK(outcome='applied'));
INSERT INTO household_reference_meta(id,version) VALUES(1,1);`;
async function readReceipts(tx) {
  const rows = await tx.getAllAsync('SELECT * FROM household_reference_receipts ORDER BY sequence');
  for (const row of rows) {
    let r; try { r = JSON.parse(row.request_json); validateRequest(r); } catch { fail('invalid_receipt_store'); }
    if (row.version !== 1 || !integer(row.sequence) || !row.sequence || row.operation_id !== r.operationId ||
      row.idempotency_key !== r.idempotencyKey || row.installation_ref !== r.installationRef ||
      row.request_fingerprint !== fingerprint(r) || row.request_json !== JSON.stringify(canonical(r)) ||
      !integer(row.content_revision) || !row.content_revision || !integer(row.write_revision) ||
      !integer(row.committed_at) || row.outcome !== 'applied') fail('invalid_receipt_store');
  }
  return rows;
}
async function validateReferenceSchema(tx) {
    const version = await tx.getAllAsync('SELECT * FROM household_reference_meta');
    if (version.length !== 1 || version[0].id !== 1 || version[0].version !== 1) fail('unsupported_receipt_schema');
    for (const [table, names] of [
      ['household_reference_meta', ['id', 'version']],
      ['household_reference_receipts', ['sequence', 'version', 'operation_id', 'idempotency_key', 'installation_ref', 'request_json', 'request_fingerprint', 'content_revision', 'write_revision', 'committed_at', 'outcome']],
    ]) {
      const columns = await tx.getAllAsync(`PRAGMA table_info(${table})`);
      if (columns.map(c => c.name).join('|') !== names.join('|')) fail('invalid_receipt_schema');
    }
    await readReceipts(tx);
}
async function ensureReferenceSchema(db) {
  await db.withExclusiveTransactionAsync(async tx => {
    const tables = await tx.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('household_reference_meta','household_reference_receipts')");
    if (!tables.length) await tx.execAsync(SCHEMA);
    else if (tables.length !== 2) fail('invalid_receipt_schema');
    await validateReferenceSchema(tx);
  });
}

// INTERNAL adapter surface. guard must come from withParentTicket, not request data.
function createHouseholdReferenceAccess({ open, serialized, decode, credentialFor, now = Date.now }) {
  const rawPayloads = new WeakMap();
  async function ready(tx) {
    const row = await tx.getFirstAsync('SELECT phase,payload FROM installation WHERE id=1');
    if (!row || row.phase !== 'ready') fail('installation_not_ready');
    const envelope = decode(row); // This path never repairs a pending installation.
    await credentialFor(envelope.credentialId);
    if (envelope.state.storageVersion !== 1 || !Array.isArray(envelope.state.assignments) ||
      !envelope.state.household || !integer(envelope.state.household.failures) || !Number.isFinite(envelope.state.household.blockedUntil) ||
      Object.hasOwn(envelope.state.household, 'credential') || !validPolicy(envelope.state.household.policy) ||
      envelope.state.assignments.some(d => !validateAssignmentDocument(d).valid) ||
      new Set(envelope.state.assignments.map(d => d.assignment.id)).size !== envelope.state.assignments.length) fail('invalid_household');
    rawPayloads.set(envelope, row.payload);
    return envelope;
  }
  async function protectedTransaction(guard, action) {
    if (typeof guard !== 'function') fail('invalid_authorization_bridge');
    guard();
    try {
      return await serialized(async () => {
        guard(); const db = await open(); let result;
        await db.withExclusiveTransactionAsync(async tx => {
          await validateReferenceSchema(tx);
          const current = await ready(tx); guard();
          result = await action(tx, current);
        });
        guard(); return copy(result);
      });
    } catch (e) { guard(); if (typeof e.code === 'string' && !e.code.startsWith('ERR_')) throw e; fail('household_coordination_failed'); }
  }
  function document(state, assignmentId) {
    const docs = state.assignments.filter(d => d?.assignment?.id === assignmentId);
    if (docs.length !== 1 || !validateAssignmentDocument(docs[0]).valid) fail('invalid_assignment');
    return docs[0];
  }
  return Object.freeze({
    readVerifiedInstallationIdentity: guard => protectedTransaction(guard, async (tx, e) => ({ installationRef: e.credentialId })),
    readReferenceReceipts: guard => protectedTransaction(guard, async (tx, e) => {
      const rows = await readReceipts(tx); if (rows.some(r => r.installation_ref !== e.credentialId)) fail('scope_mismatch');
      return rows;
    }),
    updateWithReferenceReceipt: (request, mutate, guard) => {
      validateRequest(request); const r = copy(request);
      if (!(mutate === null || typeof mutate === 'function') || (mutate === null) !== (r.payloadDigest === null) || r.kind === 'retire_binding' && mutate !== null) fail('invalid_receipt_request');
      return protectedTransaction(guard, async (tx, envelope) => {
        if (envelope.credentialId !== r.installationRef) fail('scope_mismatch');
        const receipts = await readReceipts(tx);
        if (receipts.some(row => row.installation_ref !== envelope.credentialId)) fail('scope_mismatch');
        const prior = receipts.find(row => row.operation_id === r.operationId || row.idempotency_key === r.idempotencyKey);
        if (prior) {
          if (prior.request_fingerprint !== fingerprint(r) || prior.operation_id !== r.operationId || prior.idempotency_key !== r.idempotencyKey) fail('receipt_conflict');
          return { receipt: prior, replayed: true };
        }
        const before = envelope.state;
        const matches = before.assignments.filter(d => d?.assignment?.id === r.assignmentId);
        if (r.expectedContentRevision === null) { if (matches.length || mutate === null || r.kind !== 'create_binding') fail('stale_assignment'); }
        else {
          const doc = document(before, r.assignmentId);
          if (doc.contentRevision !== r.expectedContentRevision || getWriteRevision(doc) !== r.expectedWriteRevision) fail('stale_assignment');
          if (!doc.assignment.sources.some(s => s.id === r.sourceId)) fail('source_not_found');
        }
        const next = mutate === null ? before : mutate(copy(before));
        if (next && typeof next.then === 'function') fail('async_household_mutation');
        if (!next || !Array.isArray(next.assignments) || JSON.stringify(next.household) !== JSON.stringify(before.household) ||
          next.storageVersion !== before.storageVersion || Object.keys(next).sort().join('|') !== Object.keys(before).sort().join('|') ||
          JSON.stringify(next.assignments.filter(d => d?.assignment?.id !== r.assignmentId)) !== JSON.stringify(before.assignments.filter(d => d?.assignment?.id !== r.assignmentId))) fail('invalid_household_mutation');
        const doc = document(next, r.assignmentId);
        if (!doc.assignment.sources.some(s => s.id === r.sourceId) || r.originatingContentRevision > doc.contentRevision) fail('source_not_found');
        if (mutate && fingerprint(doc) !== r.payloadDigest) fail('payload_fingerprint_mismatch');
        const committedAt = now(); if (!integer(committedAt)) fail('invalid_time');
        // All asynchronous reads are finished. First protected durable write issuance.
        guard();
        await tx.runAsync("INSERT INTO household_reference_receipts(version,operation_id,idempotency_key,installation_ref,request_json,request_fingerprint,content_revision,write_revision,committed_at,outcome) VALUES(1,?,?,?,?,?,?,?,?,'applied')",
          r.operationId, r.idempotencyKey, r.installationRef, JSON.stringify(canonical(r)), fingerprint(r), doc.contentRevision, getWriteRevision(doc), committedAt);
        if (mutate && JSON.stringify(next) !== JSON.stringify(before)) {
          const updated = { ...envelope, state: next };
          const changed = await tx.runAsync("UPDATE installation SET payload=? WHERE id=1 AND phase='ready' AND payload=?", JSON.stringify(updated), rawPayloads.get(envelope));
          if (changed.changes !== 1) fail('stale_household');
        }
        const receipt = (await readReceipts(tx)).find(row => row.operation_id === r.operationId);
        if (!receipt) fail('invalid_receipt_store');
        return { receipt, replayed: false };
      });
    },
  });
}
module.exports = { ensureReferenceSchema, createHouseholdReferenceAccess, fingerprint };
