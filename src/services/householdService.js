const { normalizeAssignment } = require('../core/assignments/normalizeAssignment');
const { validPolicy, STRICT, INDEPENDENT, evaluatePracticeEligibility } = require('../core/assignments/practiceEligibility');
const { validateAssignmentDocument, getWriteRevision, assertWriteRevision, validateApprovalEvidence, assessDetailedReviewReadiness } = require('../core/assignments/assignmentDocument');
const { enumerateEducationalFields } = require('../core/assignments/educationalFields');
const { applyFieldReview, applyMarkAllReviewed, applyParentCorrections } = require('../core/assignments/assignmentReview');

function createHouseholdService({ store, credential, now = Date.now, sessionNow = now, supported = true, development = false, sampleProvider, setupDiagnostics }) {
  let session = null;
  let expiresAt = 0;
  let generation = 0;
  let verifying = false;
  let settingUp = false;
  const TIMEOUT = 5 * 60 * 1000;
  function lock() { session = null; expiresAt = 0; generation++; }
  function authorize(capability) {
    if (!supported || !session || session !== capability || sessionNow() >= expiresAt) { lock(); throw new Error('Parent access is locked.'); }
    try { credential.assertAvailable?.(); } catch (error) { lock(); throw error; }
  }
  function noteParentActivity(capability) { authorize(capability); expiresAt = sessionNow() + TIMEOUT; }
  function validateState(state) {
    if (!state || state.storageVersion !== 1 || !Array.isArray(state.assignments) || !credential.valid(state.household?.credential) ||
      !Number.isSafeInteger(state.household.failures) || state.household.failures < 0 ||
      !Number.isFinite(state.household.blockedUntil)) throw new Error('Local configuration is invalid. Parent access is locked.');
    return state;
  }
  function requireSupport() {
    if (!supported) throw new Error('Native household practice is unavailable until its storage and authorization adapters are verified.');
    try { credential.assertAvailable?.(); } catch (error) { lock(); throw error; }
  }
  async function status() {
    requireSupport();
    const state = await store.read();
    if (state === null) return { needsSetup: true };
    validateState(state);
    return { needsSetup: false };
  }
  async function setup(pin, confirmation) {
    requireSupport();
    if (settingUp) throw new Error('Household setup is still running. Please wait; do not retry or reset data.');
    settingUp = true;
    const trace = setupDiagnostics?.start();
    const epoch = generation;
    let category = 'validation';
    function checkCancellation() {
      if (epoch !== generation) { category = 'cancelled'; throw new Error('Setup cancelled. Reopen the Parent Area.'); }
    }
    try {
      if (pin !== confirmation) throw new Error('The PINs do not match.');
      category = 'derivation';
      const record = await credential.create(pin, trace);
      checkCancellation();
      category = 'storage';
      await store.update(state => {
        checkCancellation();
        if (state !== null) throw new Error('This installation is already configured or requires recovery.');
        return { storageVersion: 1, household: { credential: record, failures: 0, blockedUntil: 0,
          policy: { policyVersion: 1, revision: 1, practiceMode: STRICT } }, assignments: [] };
      }, { trace, beforeInitialize: checkCancellation });
      trace?.finish();
    } catch (error) { trace?.finish(category); throw error; }
    finally { settingUp = false; }
  }
  async function unlock(pin) {
    if (verifying) throw new Error('PIN verification is already running. Please wait.');
    verifying = true;
    try { return await verifyPin(pin); } finally { verifying = false; }
  }
  async function verifyPin(pin) {
    requireSupport();
    const epoch = generation;
    // Reserve a persisted cooldown before expensive work; concurrent tabs cannot guess in parallel.
    const reserved = await store.update(state => {
      validateState(state);
      if (epoch !== generation) throw new Error('Unlock cancelled.');
      if (state.household.blockedUntil > now()) throw new Error('Please wait before trying the PIN again.');
      state.household.failures++;
      state.household.blockedUntil = now() + (state.household.failures >= 5 ? 30000 : 1000);
      return state;
    });
    const ok = await credential.verify(pin, reserved.household.credential);
    if (!ok) throw new Error('PIN not recognised. Please try again.');
    await store.update(state => {
      validateState(state);
      if (epoch !== generation || JSON.stringify(state.household.credential) !== JSON.stringify(reserved.household.credential)) throw new Error('Unlock cancelled.');
      state.household.failures = 0;
      state.household.blockedUntil = 0;
      return state;
    });
    if (epoch !== generation) throw new Error('Unlock cancelled.');
    session = Object.freeze({});
    expiresAt = sessionNow() + TIMEOUT;
    return session;
  }
  async function getParentPolicy(capability) {
    authorizeParentRead(capability);
    const epoch = generation;
    let stored;
    try { stored = await store.read(); }
    catch (error) { authorizeParentRead(capability, epoch); throw error; }
    authorizeParentRead(capability, epoch);
    const state = validateState(stored);
    return validPolicy(state.household.policy) ? { ...state.household.policy } : { policyVersion: 1, revision: 0, practiceMode: STRICT };
  }
  async function setPracticePolicy(capability, { expectedRevision, practiceMode, acknowledgeRisk = false }) {
    authorize(capability);
    if (![STRICT, INDEPENDENT].includes(practiceMode) || (practiceMode === INDEPENDENT && acknowledgeRisk !== true)) throw new Error('Explicit risk acknowledgement is required for independent practice.');
    const result = await store.update(state => {
      authorize(capability);
      validateState(state);
      const current = validPolicy(state.household.policy) ? state.household.policy.revision : 0;
      if (current !== expectedRevision) throw new Error('Policy changed in another tab. Reload before saving.');
      state.household.policy = { policyVersion: 1, revision: current + 1, practiceMode,
        ...(practiceMode === INDEPENDENT ? { riskAcknowledgementVersion: 1 } : {}) };
      return state;
    });
    return { ...result.household.policy };
  }
  function parentReadError(code) {
    const messages = { parent_locked: 'Parent access is locked.', persistence_failed: 'Unable to read local assignments. No data was changed.',
      unsupported_document: 'Stored assignment data is invalid or unsupported. No data was changed.',
      invalid_field: 'A valid assignment ID is required.', assignment_not_found: 'Assignment is unavailable.' };
    const error = new Error(messages[code]); error.code = code; return error;
  }
  function authorizeParentRead(capability, epoch = generation) {
    // An old response must not revoke a newer session by calling authorize with its stale token.
    if (epoch !== generation || capability !== session) throw parentReadError('parent_locked');
    try { authorize(capability); } catch { throw parentReadError('parent_locked'); }
  }
  async function readParentState(capability) {
    authorizeParentRead(capability);
    const epoch = generation;
    let state;
    try { state = await store.read(); }
    catch { authorizeParentRead(capability, epoch); throw parentReadError('persistence_failed'); }
    authorizeParentRead(capability, epoch);
    try { validateState(state); } catch { throw parentReadError('unsupported_document'); }
    return { state, epoch };
  }
  function validateParentDocument(document) {
    if (!validateAssignmentDocument(document).valid) throw parentReadError('unsupported_document');
    const id = document.assignment.id;
    const sample = document.purpose === 'development_sample' && id === 'fc004n-development-sample';
    if (id === 'grade4-reference-001' || (document.purpose === 'development_sample' && !sample) ||
      (id === 'fc004n-development-sample' && !sample)) throw parentReadError('unsupported_document');
    return !sample || development;
  }
  async function listParentAssignments(capability) {
    const { state, epoch } = await readParentState(capability);
    const ids = new Set();
    const result = [];
    for (const document of state.assignments) {
      const visible = validateParentDocument(document);
      if (ids.has(document.assignment.id)) throw parentReadError('unsupported_document');
      ids.add(document.assignment.id);
      if (!visible) continue;
      const review = assessDetailedReviewReadiness(document.assignment);
      const approvalValid = validateApprovalEvidence(document).valid;
      result.push({ id: document.assignment.id, title: document.assignment.title, purpose: document.purpose,
        reviewStatus: document.assignment.reviewStatus, reviewProgress: { reviewed: review.reviewedFieldPaths.length, total: review.fieldPaths.length },
        approvalMethod: approvalValid ? document.approval.method : null, approvalValid,
        contentRevision: document.contentRevision, writeRevision: getWriteRevision(document) });
    }
    authorizeParentRead(capability, epoch);
    return result;
  }
  async function readParentAssignment(capability, request = {}) {
    authorizeParentRead(capability);
    if (!request || Object.getPrototypeOf(request) !== Object.prototype || Object.keys(request).some(key => key !== 'assignmentId') ||
      typeof request.assignmentId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.assignmentId)) throw parentReadError('invalid_field');
    const { state, epoch } = await readParentState(capability);
    const matches = state.assignments.filter(document => document?.assignment?.id === request.assignmentId);
    if (!matches.length) throw parentReadError('assignment_not_found');
    if (matches.length !== 1) throw parentReadError('unsupported_document');
    if (!validateParentDocument(matches[0])) throw parentReadError('assignment_not_found');
    const document = JSON.parse(JSON.stringify(matches[0]));
    const result = { document, writeRevision: getWriteRevision(document), fields: enumerateEducationalFields(document.assignment),
      review: assessDetailedReviewReadiness(document.assignment), approvalValidation: validateApprovalEvidence(document) };
    authorizeParentRead(capability, epoch);
    return result;
  }
  async function mutateParentAssignment(capability, request, keys, transform) {
    authorizeParentRead(capability);
    const epoch = generation;
    if (!request || Object.getPrototypeOf(request) !== Object.prototype || Object.keys(request).some(key => !keys.includes(key)) ||
      typeof request.assignmentId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.assignmentId)) throw parentReadError('invalid_field');
    // Snapshot caller-owned input before queued asynchronous storage access.
    const input = { ...request };
    if (Array.isArray(input.fieldPaths)) input.fieldPaths = input.fieldPaths.slice();
    if (Array.isArray(input.corrections)) input.corrections = input.corrections.map(change =>
      change && Object.getPrototypeOf(change) === Object.prototype ? { ...change } : change);
    let updated;
    let operationError;
    try {
      await store.update(state => {
        try {
          authorizeParentRead(capability, epoch);
          try { validateState(state); } catch { throw parentReadError('unsupported_document'); }
          const indices = state.assignments.map((document, index) => document?.assignment?.id === input.assignmentId ? index : -1).filter(index => index !== -1);
          if (!indices.length) throw parentReadError('assignment_not_found');
          if (indices.length !== 1) throw parentReadError('unsupported_document');
          const index = indices[0];
          if (!validateParentDocument(state.assignments[index])) throw parentReadError('assignment_not_found');
          const result = transform(state.assignments[index], input);
          updated = result.document;
          if (result.changed) state.assignments[index] = updated;
          // No await between this check and adapter write issuance (FC-005-06).
          authorizeParentRead(capability, epoch);
          return state;
        } catch (error) { operationError = error; throw error; }
      });
    } catch {
      authorizeParentRead(capability, epoch);
      if (operationError) throw operationError;
      const error = new Error('Unable to save local assignment. Reopen it before retrying.');
      error.code = 'persistence_failed'; throw error;
    }
    // Issued writes may finish after locking; never return protected stale results.
    authorizeParentRead(capability, epoch);
    return JSON.parse(JSON.stringify(updated));
  }
  function setFieldReview(capability, request) {
    return mutateParentAssignment(capability, request, ['assignmentId', 'expectedWriteRevision', 'fieldPaths', 'reviewed'], (document, input) => {
      if (typeof input.reviewed !== 'boolean') throw parentReadError('invalid_field');
      return applyFieldReview(document, input);
    });
  }
  function markAllReviewed(capability, request) {
    return mutateParentAssignment(capability, request, ['assignmentId', 'expectedWriteRevision', 'confirmReviewDeclaration'], applyMarkAllReviewed);
  }
  function saveParentCorrections(capability, request) {
    return mutateParentAssignment(capability, request, ['assignmentId', 'expectedWriteRevision', 'corrections'], applyParentCorrections);
  }
  function approveAssignment(document, input, detailed) {
    function fail(code) { const error = new Error(code); error.code = code; throw error; }
    assertWriteRevision(document, input.expectedWriteRevision);
    if (input.confirmAcceptance !== true || (detailed ? input.confirmNoKnownGaps !== true : input.acknowledgeRisk !== true)) fail('confirmation_required');
    const readiness = detailed ? assessDetailedReviewReadiness(document.assignment) : null;
    if (readiness?.gaps.length) fail('known_gaps');
    if (readiness?.unreviewedFieldPaths.length) fail('review_incomplete');
    const revision = getWriteRevision(document);
    if (revision === Number.MAX_SAFE_INTEGER) fail('revision_overflow');
    const acceptedAt = new Date(now());
    if (!Number.isFinite(acceptedAt.getTime())) fail('invalid_accepted_at');
    const next = JSON.parse(JSON.stringify(document));
    next.assignment.reviewStatus = 'approved';
    next.writeRevision = revision + 1;
    next.approval = { method: detailed ? 'reviewed' : 'bulk_risk_acknowledged', contentRevision: document.contentRevision,
      acceptedAt: acceptedAt.toISOString(), ...(detailed ? { reviewedFieldPaths: readiness.fieldPaths } : { riskAcknowledgementVersion: 1 }) };
    if (!validateApprovalEvidence(next).valid) fail('invalid_approval');
    return { document: next, changed: true };
  }
  function approveReviewedAssignment(capability, request) {
    return mutateParentAssignment(capability, request, ['assignmentId', 'expectedWriteRevision', 'confirmAcceptance', 'confirmNoKnownGaps'],
      (document, input) => approveAssignment(document, input, true));
  }
  function approveWithoutDetailedReview(capability, request) {
    return mutateParentAssignment(capability, request, ['assignmentId', 'expectedWriteRevision', 'acknowledgeRisk', 'confirmAcceptance'],
      (document, input) => approveAssignment(document, input, false));
  }
  // Student submission cannot manufacture protected parent declarations.
  async function submitAssignment(input) {
    requireSupport();
    const assignment = normalizeAssignment(input);
    if (['grade4-reference-001', 'fc004n-development-sample'].includes(assignment.id) || assignment.reviewStatus !== 'pending_review') throw new Error('Submit a pending household assignment, not a demo or approval.');
    function check(value) {
      if (!value || typeof value !== 'object') return;
      if (value.reviewStatus === 'approved') throw new Error('Student submission cannot approve content.');
      if (value.origin === 'parent_corrected') throw new Error('Student submission cannot claim a parent correction.');
      if (Object.hasOwn(value, 'correctionExplanation')) throw new Error('Student submission cannot claim a parent correction.');
      if (value.fidelity === 'verified_transcription') throw new Error('Student submission cannot verify source fidelity.');
      Object.values(value).forEach(check);
    }
    check(assignment);
    await store.update(state => {
      validateState(state);
      if (state.assignments.some(document => document.assignment?.id === assignment.id)) throw new Error('Assignment already exists. Editing belongs to the Parent Area.');
      state.assignments.push({ storageVersion: 1, contentRevision: 1, writeRevision: 1, purpose: 'household_assignment', assignment, approval: null });
      return state;
    });
    return assignment.id;
  }
  async function readPractice(assignmentId) {
    requireSupport();
    const state = validateState(await store.read());
    const document = state.assignments.find(item => item.assignment?.id === assignmentId);
    const eligibility = evaluatePracticeEligibility({ assignmentDocument: document, householdPolicy: state.household.policy, development });
    return { document: eligibility.eligible ? document : undefined, policy: validPolicy(state.household.policy) ? state.household.policy : null, eligibility };
  }
  async function listPracticeAssignments() {
    requireSupport();
    const state = await store.read();
    if (state === null) return [];
    validateState(state);
    return state.assignments.filter(item => (item.purpose === 'household_assignment' || (development && item.purpose === 'development_sample')) && item.assignment?.id !== 'grade4-reference-001')
      .map(item => ({ id: item.assignment?.id, title: item.assignment?.title, ...evaluatePracticeEligibility({ assignmentDocument: item, householdPolicy: state.household.policy, development }) }));
  }
  async function loadDevelopmentSample(capability) {
    authorize(capability);
    if (!development || !sampleProvider) throw new Error('Development sample loading is unavailable in production.');
    const assignment = normalizeAssignment(sampleProvider());
    if (assignment.id !== 'fc004n-development-sample' || assignment.reviewStatus !== 'pending_review') throw new Error('Invalid development sample.');
    await store.update(state => {
      authorize(capability); validateState(state);
      const existing = state.assignments.find(document => document.assignment?.id === assignment.id);
      if (existing) {
        if (state.assignments.filter(document => document.assignment?.id === assignment.id).length !== 1 || existing.purpose !== 'development_sample' || !validateAssignmentDocument(existing).valid) throw new Error('Existing sample is invalid; no content was overwritten.');
        return state;
      }
      state.assignments.push({ storageVersion: 1, contentRevision: 1, writeRevision: 1, purpose: 'development_sample', assignment, approval: null });
      return state;
    });
    return assignment.id;
  }
  return { status, setup, unlock, lock, noteParentActivity, getParentPolicy, setPracticePolicy, listParentAssignments, readParentAssignment,
    setFieldReview, markAllReviewed, saveParentCorrections,
    approveReviewedAssignment, approveWithoutDetailedReview,
    submitAssignment, readPractice, listPracticeAssignments, loadDevelopmentSample,
    readSetupDiagnostics: () => setupDiagnostics?.snapshot() || [],
    subscribeSetupDiagnostics: listener => setupDiagnostics?.subscribe(listener) || (() => {}),
  };
}
module.exports = { createHouseholdService };
