const { normalizeAssignment } = require('../core/assignments/normalizeAssignment');
const { validPolicy, STRICT, INDEPENDENT, evaluatePracticeEligibility } = require('../core/assignments/practiceEligibility');

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
    authorize(capability);
    const state = validateState(await store.read());
    authorize(capability);
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
  // Student submission is intentionally narrow. Review/correction/approval commands belong to FC-005.
  async function submitAssignment(input) {
    requireSupport();
    const assignment = normalizeAssignment(input);
    if (['grade4-reference-001', 'fc004n-development-sample'].includes(assignment.id) || assignment.reviewStatus !== 'pending_review') throw new Error('Submit a pending household assignment, not a demo or approval.');
    function check(value) {
      if (!value || typeof value !== 'object') return;
      if (value.reviewStatus === 'approved') throw new Error('Student submission cannot approve content.');
      if (value.origin === 'parent_corrected') throw new Error('Student submission cannot claim a parent correction.');
      if (value.fidelity === 'verified_transcription') throw new Error('Student submission cannot verify source fidelity.');
      Object.values(value).forEach(check);
    }
    check(assignment);
    await store.update(state => {
      validateState(state);
      if (state.assignments.some(document => document.assignment?.id === assignment.id)) throw new Error('Assignment already exists. Editing belongs to the Parent Area.');
      state.assignments.push({ storageVersion: 1, contentRevision: 1, purpose: 'household_assignment', assignment, approval: null });
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
        if (existing.purpose !== 'development_sample' || JSON.stringify(existing.assignment) !== JSON.stringify(assignment) || existing.approval !== null) throw new Error('Existing sample differs; no content was overwritten.');
        return state;
      }
      state.assignments.push({ storageVersion: 1, contentRevision: 1, purpose: 'development_sample', assignment, approval: null });
      return state;
    });
    return assignment.id;
  }
  return { status, setup, unlock, lock, noteParentActivity, getParentPolicy, setPracticePolicy, submitAssignment, readPractice, listPracticeAssignments, loadDevelopmentSample,
    readSetupDiagnostics: () => setupDiagnostics?.snapshot() || [],
    subscribeSetupDiagnostics: listener => setupDiagnostics?.subscribe(listener) || (() => {}),
  };
}
module.exports = { createHouseholdService };
