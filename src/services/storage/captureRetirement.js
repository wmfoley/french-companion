// Internal durable retirement format. No file effects or deletion authority.
const { sha256 } = require('@noble/hashes/sha2.js');
const integer = x => Number.isSafeInteger(x) && x >= 0;
const id = x => typeof x === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
function fail(code = 'invalid_retirement') { const e = new Error(code); e.code = code; throw e; }
function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  return x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
}
const encode = x => JSON.stringify(canonical(x));
const digest = x => Array.from(sha256(new TextEncoder().encode(encode(x))), b => b.toString(16).padStart(2, '0')).join('');
const SCHEMA = `CREATE TABLE retirement_events(event_id TEXT PRIMARY KEY, event_version INTEGER NOT NULL CHECK(event_version=1), binding_id TEXT NOT NULL UNIQUE, operation_id TEXT NOT NULL UNIQUE REFERENCES coordination_operations(id), idempotency_key TEXT NOT NULL UNIQUE, installation_ref TEXT NOT NULL, committed_reference_epoch INTEGER NOT NULL UNIQUE CHECK(committed_reference_epoch>0), event_json TEXT NOT NULL);
CREATE INDEX retirement_events_scope ON retirement_events(installation_ref);
PRAGMA user_version=4;`;
function validateRequest(r) {
  if (r.kind !== 'retire' || r.requestVersion !== 2 || !id(r.retirementEventId) || !hash(r.bindingFingerprint) ||
    !integer(r.originatingContentRevision) || !r.originatingContentRevision || r.householdRevisions.length !== 1 ||
    r.householdRevisions[0].assignmentId !== r.assignmentId || r.originatingContentRevision > r.householdRevisions[0].contentRevision) fail();
}
function bindingFor(manifest, r) {
  validateRequest(r);
  const binding = manifest.bindings.find(b => b.id === r.bindingId);
  if (!binding || binding.assetId !== r.assetId || binding.assignmentId !== r.assignmentId || binding.sourceId !== r.sourceId ||
    binding.contentRevision !== r.originatingContentRevision || digest(binding) !== r.bindingFingerprint) fail('binding_mismatch');
  return binding;
}
function receiptRequest(op) {
  const r = op.request; const revision = r.householdRevisions[0];
  return { operationId: r.receiptOperationId, idempotencyKey: r.idempotencyKey, kind: 'retire_binding', installationRef: op.installationRef,
    assetId: r.assetId, bindingId: r.bindingId, assignmentId: r.assignmentId, sourceId: r.sourceId, originatingContentRevision: r.originatingContentRevision,
    expectedContentRevision: revision.contentRevision, expectedWriteRevision: revision.writeRevision,
    referenceEpoch: r.expectedReferenceEpoch, reservationGeneration: op.reservationGeneration, payloadDigest: null };
}
function makeEvent(op, receipt, retiredAt) {
  const r = op.request;
  return { eventVersion: 1, eventId: r.retirementEventId, kind: 'retire_binding', operationId: r.operationId, idempotencyKey: r.idempotencyKey,
    installationRef: op.installationRef, bindingId: r.bindingId, assetId: r.assetId, assignmentId: r.assignmentId, sourceId: r.sourceId,
    originatingContentRevision: r.originatingContentRevision, bindingFingerprint: r.bindingFingerprint, requestFingerprint: op.fingerprint,
    receiptOperationId: r.receiptOperationId, receiptSequence: receipt.sequence, receiptFingerprint: receipt.request_fingerprint,
    expectedManifestRevision: r.expectedManifestRevision, committedManifestRevision: r.expectedManifestRevision,
    expectedReferenceEpoch: r.expectedReferenceEpoch, reservationGeneration: op.reservationGeneration, committedReferenceEpoch: op.reservationGeneration + 1,
    expectedHouseholdRevisions: r.householdRevisions,
    committedHouseholdRevisions: [{ assignmentId: r.assignmentId, contentRevision: receipt.content_revision, writeRevision: receipt.write_revision }], retiredAt };
}
function completion(event) {
  return { eventId: event.eventId, eventFingerprint: digest(event), receiptOperationId: event.receiptOperationId, receiptSequence: event.receiptSequence,
    receiptFingerprint: event.receiptFingerprint, expectedManifestRevision: event.expectedManifestRevision, committedManifestRevision: event.committedManifestRevision,
    expectedReferenceEpoch: event.expectedReferenceEpoch, reservationGeneration: event.reservationGeneration, committedReferenceEpoch: event.committedReferenceEpoch,
    expectedHouseholdRevisions: event.expectedHouseholdRevisions, committedHouseholdRevisions: event.committedHouseholdRevisions };
}
async function readEvents(tx, manifest, scope, operations) {
  const columns = await tx.getAllAsync('PRAGMA table_info(retirement_events)');
  if (columns.map(c => c.name).join('|') !== 'event_id|event_version|binding_id|operation_id|idempotency_key|installation_ref|committed_reference_epoch|event_json') fail();
  const indexes = await tx.getAllAsync('PRAGMA index_list(retirement_events)'); const unique = new Set(); let scopeIndex = false;
  for (const index of indexes) {
    if (!/^[a-zA-Z0-9_]+$/.test(index.name)) fail();
    const names = (await tx.getAllAsync(`PRAGMA index_info(${index.name})`)).map(c => c.name).join('|');
    if (index.unique === 1 && index.partial === 0) unique.add(names);
    if (index.name === 'retirement_events_scope' && index.unique === 0 && index.partial === 0 && names === 'installation_ref') scopeIndex = true;
  }
  if (!scopeIndex || ['event_id', 'binding_id', 'operation_id', 'idempotency_key', 'committed_reference_epoch'].some(k => !unique.has(k))) fail();
  const rows = await tx.getAllAsync('SELECT * FROM retirement_events ORDER BY event_id');
  for (const key of ['event_id', 'binding_id', 'operation_id', 'idempotency_key', 'committed_reference_epoch']) {
    if (new Set(rows.map(r => r[key])).size !== rows.length) fail();
  }
  const events = rows.map(row => {
    let event; try { event = JSON.parse(row.event_json); } catch { fail(); }
    const op = operations.find(o => o.request.operationId === row.operation_id);
    if (!scope || !op || op.recordVersion !== 3 || op.phase !== 'complete' || !integer(event?.receiptSequence) || !event.receiptSequence ||
      !hash(event.receiptFingerprint) || event.receiptFingerprint !== digest(receiptRequest(op)) || !integer(event.retiredAt) || event.retiredAt < op.createdAt || event.retiredAt !== op.updatedAt ||
      row.event_version !== 1 || row.event_id !== event.eventId || row.binding_id !== event.bindingId || row.idempotency_key !== event.idempotencyKey ||
      row.installation_ref !== event.installationRef || event.installationRef !== scope.installation_ref || row.committed_reference_epoch !== event.committedReferenceEpoch ||
      event.committedReferenceEpoch > scope.reference_epoch || !integer(event.committedReferenceEpoch)) fail();
    bindingFor(manifest, op.request);
    const revision = op.request.householdRevisions[0];
    const expected = makeEvent(op, { sequence: event.receiptSequence, request_fingerprint: event.receiptFingerprint, content_revision: revision.contentRevision, write_revision: revision.writeRevision }, event.retiredAt);
    if (row.event_json !== encode(event) || encode(expected) !== row.event_json || encode(op.completion) !== encode(completion(event))) fail();
    return event;
  });
  if (operations.some(o => o.recordVersion === 3 && o.phase === 'complete' && !events.some(e => e.operationId === o.request.operationId))) fail();
  return events;
}
async function insert(tx, event) {
  await tx.runAsync('INSERT INTO retirement_events VALUES(?,?,?,?,?,?,?,?)', event.eventId, 1, event.bindingId, event.operationId,
    event.idempotencyKey, event.installationRef, event.committedReferenceEpoch, encode(event));
}
module.exports = { SCHEMA, validateRequest, bindingFor, receiptRequest, makeEvent, completion, readEvents, insert };
