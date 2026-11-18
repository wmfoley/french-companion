const { receiptRequest } = require('./storage/captureCoordination');
function fail(code) { const error = new Error(code); error.code = code; throw error; }

// INTERNAL trusted composition only. No factory use in production startup or UI.
function createCaptureBindingCoordinator({ household, parentBridge, householdReferences, capture, newOwner, now }) {
  async function perform(capability, input, kind) {
    // Snapshot intent before any asynchronous work; the capture adapter enforces exact shape.
    const request = JSON.parse(JSON.stringify(input));
    if (request.kind !== kind || !Array.isArray(request.householdRevisions) || request.householdRevisions.length !== 1 ||
      request.householdRevisions[0].assignmentId !== request.assignmentId) fail('invalid_binding_request');
    if (kind === 'retire' && request.requestVersion !== 2) fail('legacy_retirement_reconciliation_required');
    const ticket = parentBridge.captureParentTicket(capability);
    return parentBridge.withParentTicket(ticket, async guard => {
      const identity = await householdReferences.readVerifiedInstallationIdentity(guard);
      await capture.assertInstallation(identity.installationRef);
      const expected = request.householdRevisions[0];
      async function verifyTarget() {
        const snapshot = await household.readParentAssignment(capability, { assignmentId: request.assignmentId });
        if (snapshot.document.contentRevision !== expected.contentRevision || snapshot.writeRevision !== expected.writeRevision) fail('stale_assignment');
        if (!snapshot.document.assignment.sources.some(s => s.id === request.sourceId)) fail('source_not_found');
      }
      const previous = kind === 'retire' ? (await capture.inspect()).operations.find(o => o.request.operationId === request.operationId) : null;
      if (!(kind === 'retire' && previous?.phase === 'complete')) await verifyTarget();
      guard(); const reservation = await capture.reserve(request); const op = reservation.operation;
      if (op.installationRef !== identity.installationRef) fail('scope_mismatch');
      let claimed = op;
      if (op.phase !== 'complete') claimed = await capture.claim(request.operationId, op.ownerGeneration, newOwner());
      const receiptInput = receiptRequest(op);
      const readReceipt = async () => {
        const rows = await householdReferences.readReferenceReceipts(guard);
        return rows.find(r => r.operation_id === request.receiptOperationId || r.idempotency_key === request.idempotencyKey);
      };
      let receipt = await readReceipt();
      if (!receipt) {
        if (op.phase === 'complete') fail('receipt_missing');
        // Lease and existing session validation are synchronous at household SQL issuance.
        const issuedGuard = () => { guard(); const t = now(); if (!Number.isSafeInteger(t) || t < 0 || t >= claimed.leaseUntil) fail('stale_owner'); };
        await capture.validateIssuance(request.operationId, claimed.ownerGeneration, claimed.owner);
        issuedGuard();
        await householdReferences.updateWithReferenceReceipt(receiptInput, null, issuedGuard);
        receipt = await readReceipt();
      }
      // Capture commit rereads durable receipt inside its transaction. No caller receipt object is authority.
      const commit = kind === 'retire' ? capture.commitRetirement : capture.commitBinding;
      return commit(request.operationId, claimed.ownerGeneration, claimed.owner, async () => {
        if (!(kind === 'retire' && op.phase === 'complete')) await verifyTarget(); return readReceipt();
      }, guard);
    });
  }
  const bind = (capability, request) => perform(capability, request, 'bind');
  const retire = (capability, request) => perform(capability, request, 'retire');
  return Object.freeze({ bind, retire, recover: (capability, request) => request?.kind === 'retire' ? retire(capability, request) : bind(capability, request) });
}
module.exports = { createCaptureBindingCoordinator };
