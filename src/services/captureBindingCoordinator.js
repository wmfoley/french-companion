const { receiptRequest } = require('./storage/captureCoordination');
function fail(code) { const error = new Error(code); error.code = code; throw error; }

// INTERNAL trusted composition only. No factory use in production startup or UI.
function createCaptureBindingCoordinator({ household, parentBridge, householdReferences, capture, newOwner, now }) {
  async function bind(capability, input) {
    // Snapshot intent before any asynchronous work; the capture adapter enforces exact shape.
    const request = JSON.parse(JSON.stringify(input));
    if (request.kind !== 'bind' || !Array.isArray(request.householdRevisions) || request.householdRevisions.length !== 1 ||
      request.householdRevisions[0].assignmentId !== request.assignmentId) fail('invalid_binding_request');
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
      await verifyTarget();
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
      return capture.commitBinding(request.operationId, claimed.ownerGeneration, claimed.owner, async () => { await verifyTarget(); return readReceipt(); }, guard);
    });
  }
  return Object.freeze({ bind, recover: bind });
}
module.exports = { createCaptureBindingCoordinator };
