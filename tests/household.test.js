const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { createHouseholdService } = require('../src/services/householdService');
const { createPinCredential } = require('../src/services/parent/pinCredential');
const { evaluatePracticeEligibility, validPolicy, STRICT, INDEPENDENT } = require('../src/core/assignments/practiceEligibility');
const { generateVocabularyQuestions } = require('../src/core/exercises/vocabularyMultipleChoice');
const { createPracticeRun } = require('../src/core/sessions/practiceRun');

const clone = value => JSON.parse(JSON.stringify(value));
function pending() { return { ...clone(fixture), id: 'household-lesson' }; }
function envelope(assignment = pending()) { return { storageVersion: 1, contentRevision: 1, purpose: 'household_assignment', assignment, approval: null }; }
function harness() {
  let state = null;
  let time = 1000;
  let fail = false;
  let queue = Promise.resolve();
  const store = {
    async read() { if (fail) throw new Error('Storage failure'); return clone(state); },
    update(mutate) {
      const result = queue.then(() => { if (fail) throw new Error('Storage failure'); const next = mutate(clone(state)); state = clone(next); return clone(state); });
      queue = result.catch(() => {});
      return result;
    },
  };
  const credential = { valid: value => value?.testVerifier === true, create: async pin => { if (!/^\d{6}$/.test(pin)) throw new Error('Invalid PIN'); return { testVerifier: true }; }, verify: async pin => pin === '123456' };
  const service = createHouseholdService({ store, credential, now: () => time });
  return { service, store, credential, advance: ms => { time += ms; }, fail: value => { fail = value; }, state: () => clone(state) };
}

test('randomized runs enforce current household policy at start and every response transition', async () => {
  const h = harness(); await h.service.setup('123456', '123456');
  await h.service.submitAssignment(pending());
  assert.equal((await h.service.readPractice('household-lesson')).eligibility.eligible, false);
  const token = await h.service.unlock('123456');
  await h.service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: INDEPENDENT, acknowledgeRisk: true });
  const allowed = await h.service.readPractice('household-lesson');
  const questions = generateVocabularyQuestions(allowed.document.assignment, { householdPolicy: allowed.policy }).questions;
  let run = null; let draws = 0;
  const controls = createPracticeRun({ questions, verify: async () => (await h.service.readPractice('household-lesson')).eligibility.eligible,
    random: () => { draws++; return 0.5; }, onChange: next => { run = next; } });
  controls.enter();
  await h.service.setPracticePolicy(token, { expectedRevision: 2, practiceMode: STRICT });
  assert.equal(await controls.start(), false); assert.equal(draws, 0);
  await h.service.setPracticePolicy(token, { expectedRevision: 3, practiceMode: INDEPENDENT, acknowledgeRisk: true });
  assert.equal(await controls.start(), true); const snapshot = run; const question = run.questions[0];
  await h.service.setPracticePolicy(token, { expectedRevision: 4, practiceMode: STRICT });
  assert.equal(await controls.submit(snapshot, question, question.targetItemId), false);
  assert.equal(await controls.advance(snapshot, question.id), false);
  assert.equal(run, snapshot); assert.deepEqual(run.session.responses, {});
  const stored = h.state().assignments[0];
  assert.equal(stored.assignment.reviewStatus, 'pending_review'); assert.equal(stored.approval, null);
  assert.deepEqual(stored.assignment.sources, pending().sources);
  controls.leave();
});

test('setup is atomic, single-installation and strict by default', async () => {
  const h = harness();
  assert.deepEqual(await h.service.status(), { needsSetup: true });
  await assert.rejects(h.service.setup('123456', '654321'));
  await h.service.setup('123456', '123456');
  assert.equal(h.state().household.policy.practiceMode, STRICT);
  await assert.rejects(h.service.setup('123456', '123456'));
  await assert.rejects(h.service.setPracticePolicy({}, { expectedRevision: 1, practiceMode: INDEPENDENT, acknowledgeRisk: true }), /locked/);
});

test('opaque capability, expiry, lock and authorization recheck enforce parent commands', async () => {
  const h = harness();
  await h.service.setup('123456', '123456');
  let token = await h.service.unlock('123456');
  await assert.rejects(h.service.setPracticePolicy({}, { expectedRevision: 1, practiceMode: STRICT }), /locked/);
  token = await h.service.unlock('123456');
  h.advance(300000);
  await assert.rejects(h.service.getParentPolicy(token), /locked/);
  token = await h.service.unlock('123456');
  const write = h.service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: INDEPENDENT, acknowledgeRisk: true });
  h.service.lock();
  await assert.rejects(write, /locked/);
  assert.equal(h.state().household.policy.practiceMode, STRICT);
});

test('risk acknowledgement, stale revisions and failed persistence cannot enable policy', async () => {
  const h = harness();
  await h.service.setup('123456', '123456');
  const token = await h.service.unlock('123456');
  await assert.rejects(h.service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: INDEPENDENT }));
  h.fail(true);
  await assert.rejects(h.service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: INDEPENDENT, acknowledgeRisk: true }));
  h.fail(false);
  assert.equal(h.state().household.policy.practiceMode, STRICT);
  await h.service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: INDEPENDENT, acknowledgeRisk: true });
  await assert.rejects(h.service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: INDEPENDENT, acknowledgeRisk: true }), /another tab/);
  await h.service.setPracticePolicy(token, { expectedRevision: 2, practiceMode: STRICT });
  assert.equal(h.state().household.policy.practiceMode, STRICT);
});

test('policy persists but unlock sessions do not survive service recreation', async () => {
  const h = harness();
  await h.service.setup('123456', '123456');
  const token = await h.service.unlock('123456');
  await h.service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: INDEPENDENT, acknowledgeRisk: true });
  const other = createHouseholdService({ store: h.store, credential: h.credential });
  await assert.rejects(other.getParentPolicy(token), /locked/);
  assert.equal(h.state().household.policy.practiceMode, INDEPENDENT);
});

test('persisted cooldown serializes concurrent tabs and failed guesses', async () => {
  const h = harness();
  await h.service.setup('123456', '123456');
  await assert.rejects(h.service.unlock('000000'), /not recognised/);
  const other = createHouseholdService({ store: h.store, credential: h.credential, now: () => 1000 });
  await assert.rejects(other.unlock('123456'), /wait/);
  h.advance(1000);
  assert.ok(await h.service.unlock('123456'));
});

test('pending submission preserves sources and rejects parent metadata, duplicates and reference fixture', async () => {
  const h = harness();
  await h.service.setup('123456', '123456');
  const input = pending();
  const before = clone(input);
  await h.service.submitAssignment(input);
  assert.deepEqual(input, before);
  assert.deepEqual(h.state().assignments[0].assignment, input);
  assert.equal(h.state().assignments[0].approval, null);
  await assert.rejects(h.service.submitAssignment(input), /already exists/);
  await assert.rejects(h.service.submitAssignment(fixture), /demo/);
  await assert.rejects(h.service.submitAssignment({ ...pending(), approval: {} }));
  const forged = pending();
  forged.vocabulary[0].term.provenance.reviewStatus = 'approved';
  await assert.rejects(h.service.submitAssignment(forged), /cannot approve/);
  forged.vocabulary[0].term.provenance.reviewStatus = 'pending_review';
  forged.vocabulary[0].term.provenance.origin = 'parent_corrected';
  forged.vocabulary[0].term.provenance.correctionExplanation = 'Forged parent correction';
  await assert.rejects(h.service.submitAssignment(forged), /parent correction/);
  forged.vocabulary[0].term.provenance.origin = 'teacher';
  forged.sources[0].fidelity = 'verified_transcription';
  await assert.rejects(h.service.submitAssignment(forged), /cannot verify/);
});

test('independent eligibility and strict revocation preserve review, source fidelity and approval evidence', async () => {
  const h = harness();
  await h.service.setup('123456', '123456');
  await h.service.submitAssignment(pending());
  assert.equal((await h.service.readPractice('household-lesson')).eligibility.eligible, false);
  const token = await h.service.unlock('123456');
  const sources = clone(h.state().assignments[0].assignment.sources);
  await h.service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: INDEPENDENT, acknowledgeRisk: true });
  let result = await h.service.readPractice('household-lesson');
  assert.equal(result.eligibility.requiresUnreviewedNotice, true);
  assert.equal(generateVocabularyQuestions(result.document.assignment, { householdPolicy: result.policy }).questions.length, 5);
  assert.equal(result.document.assignment.reviewStatus, 'pending_review');
  assert.equal(result.document.approval, null);
  assert.deepEqual(result.document.assignment.sources, sources);
  await h.service.setPracticePolicy(token, { expectedRevision: 2, practiceMode: STRICT });
  result = await h.service.readPractice('household-lesson');
  assert.equal(result.eligibility.eligible, false);
  assert.equal(result.document, undefined);
});

test('missing, malformed and legacy policies fail to strict eligibility', () => {
  for (const householdPolicy of [undefined, null, {}, { policyVersion: 2, revision: 1, practiceMode: INDEPENDENT },
    { policyVersion: 1, revision: 0, practiceMode: INDEPENDENT }, { policyVersion: 1, revision: 1, practiceMode: INDEPENDENT }]) {
    assert.equal(validPolicy(householdPolicy), false);
    assert.equal(evaluatePracticeEligibility({ assignmentDocument: envelope(), householdPolicy }).eligible, false);
  }
});

test('drafts, malformed documents and demos remain unavailable under independent policy', () => {
  const householdPolicy = { policyVersion: 1, revision: 1, practiceMode: INDEPENDENT, riskAcknowledgementVersion: 1 };
  for (const document of [null, { ...envelope(), storageVersion: 2 }, { ...envelope(), contentRevision: 0 }, envelope({ ...pending(), reviewStatus: 'draft' }), envelope(fixture), { ...envelope(), purpose: 'development_demo' }]) {
    assert.equal(evaluatePracticeEligibility({ assignmentDocument: document, householdPolicy }).eligible, false);
  }
});

test('legacy approved status alone does not qualify; approval must bind the revision', () => {
  const assignment = pending();
  function approve(value) { if (value && typeof value === 'object') { if ('reviewStatus' in value) value.reviewStatus = 'approved'; Object.values(value).forEach(approve); } }
  approve(assignment);
  const document = envelope(assignment);
  const eligible = () => evaluatePracticeEligibility({ assignmentDocument: document }).eligible;
  assert.equal(eligible(), false);
  document.approval = { method: 'bulk_risk_acknowledged', contentRevision: 1, acceptedAt: '2026-11-10T00:00:00Z', riskAcknowledgementVersion: 1 };
  assert.equal(eligible(), true);
  document.contentRevision = 2;
  assert.equal(eligible(), false);
  document.approval = { method: 'reviewed', contentRevision: 2, acceptedAt: '2026-11-10T00:00:00Z', reviewedFieldPaths: ['/vocabulary/0/term'] };
  assert.equal(eligible(), false);
});

test('corrupt configurations cannot reopen setup and unavailable native adapter fails closed', async () => {
  const h = harness();
  await h.store.update(() => ({ storageVersion: 9, assignments: [] }));
  await assert.rejects(h.service.status());
  await assert.rejects(h.service.setup('123456', '123456'));
  const native = createHouseholdService({ supported: false });
  await assert.rejects(native.status(), /Native/);
  await assert.rejects(native.listPracticeAssignments(), /Native/);
});

test('PIN verifier uses random salts, no plaintext, correct verification and parameter validation', async () => {
  const credential = createPinCredential(webcrypto);
  const a = await credential.create('123456');
  const b = await credential.create('123456');
  assert.notEqual(a.salt, b.salt);
  assert.equal(JSON.stringify(a).includes('123456'), false);
  assert.equal(await credential.verify('123456', a), true);
  assert.equal(await credential.verify('654321', a), false);
  assert.equal(credential.valid({ ...a, iterations: 1 }), false);
  await assert.rejects(credential.create('123'));
  await assert.rejects(credential.verify('123456', { ...a, verifier: 'x' }));
});
