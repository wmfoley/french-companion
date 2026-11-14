const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { enumerateEducationalFields } = require('../src/core/assignments/educationalFields');
const { validateAssignmentDocument, getWriteRevision, assertWriteRevision, validateApprovalEvidence, assessDetailedReviewReadiness } = require('../src/core/assignments/assignmentDocument');
const { evaluatePracticeEligibility } = require('../src/core/assignments/practiceEligibility');
const { generateVocabularyQuestions } = require('../src/core/exercises/vocabularyMultipleChoice');
const clone = value => JSON.parse(JSON.stringify(value));
function document() { return { storageVersion: 1, contentRevision: 1, purpose: 'household_assignment', assignment: { ...clone(fixture), id: 'lesson' }, approval: null }; }
function bulk() { const d = document(); d.assignment.reviewStatus = 'approved'; d.approval = { method: 'bulk_risk_acknowledged', contentRevision: 1, acceptedAt: '2026-11-11T00:00:00Z', riskAcknowledgementVersion: 1 }; return d; }
function detailed() {
  const d = bulk();
  for (const field of enumerateEducationalFields(d.assignment)) field.path.slice(1).split('/').reduce((v, k) => v[k], d.assignment).provenance.reviewStatus = 'approved';
  d.approval = { method: 'reviewed', contentRevision: 1, acceptedAt: '2026-11-11T00:00:00.000Z', reviewedFieldPaths: enumerateEducationalFields(d.assignment).map(f => f.path) };
  return d;
}

test('legacy reads derive revision zero without mutating or minting evidence', () => {
  const d = document(); delete d.approval; const before = JSON.stringify(d); Object.freeze(d);
  assert.equal(validateAssignmentDocument(d).valid, true); assert.equal(getWriteRevision(d), 0);
  assert.doesNotThrow(() => assertWriteRevision(d, 0)); assert.equal(validateApprovalEvidence(d).valid, false);
  assert.equal(JSON.stringify(d), before); assert.equal(Object.hasOwn(d, 'writeRevision'), false);
  const current = { ...d, writeRevision: 3 }; assert.equal(getWriteRevision(current), 3); assertWriteRevision(current, 3);
});

test('malformed envelopes and supplied revisions are never treated as legacy defaults', () => {
  for (const value of [undefined, null, -1, 0, 0.5, '1', true, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const d = { ...document(), writeRevision: value };
    assert.equal(validateAssignmentDocument(d).valid, false); assert.throws(() => getWriteRevision(d));
  }
  for (const value of [null, [], {}, { ...document(), storageVersion: 2 }, { ...document(), purpose: 'unknown' }, { ...document(), extra: true },
    { ...document(), contentRevision: 0 }, { ...document(), contentRevision: 1.5 }, { ...document(), contentRevision: Number.MAX_SAFE_INTEGER + 1 }]) assert.equal(validateAssignmentDocument(value).valid, false);
  for (const expected of [-1, 0.5, '0', undefined, Infinity]) assert.throws(() => assertWriteRevision(document(), expected));
  assert.throws(() => assertWriteRevision(document(), 1), { code: 'stale_document' });
  assert.throws(() => assertWriteRevision({ ...document(), writeRevision: 1 }, 0), { code: 'stale_document' });
  const cyclic = {}; cyclic.self = cyclic;
  for (const value of [undefined, () => {}, new Date(), NaN, { method: undefined }, Array(1), cyclic]) {
    assert.equal(validateAssignmentDocument({ ...document(), approval: value }).valid, false);
  }
});

test('detailed evidence requires complete declared review; bulk acceptance retains pending fields', () => {
  const d = detailed(); assert.equal(validateApprovalEvidence(d).valid, true);
  const b = bulk(); const before = JSON.stringify(b);
  assert.equal(validateAssignmentDocument(b).valid, true); assert.equal(validateApprovalEvidence(b).valid, true);
  assert.equal(evaluatePracticeEligibility({ assignmentDocument: b }).eligible, true);
  assert.equal(b.assignment.vocabulary[0].term.provenance.reviewStatus, 'pending_review'); assert.equal(JSON.stringify(b), before);
  d.assignment.vocabulary[0].term.provenance.reviewStatus = 'pending_review'; assert.equal(validateApprovalEvidence(d).valid, false);
  const noReceipt = document(); noReceipt.assignment.reviewStatus = 'approved';
  assert.equal(validateAssignmentDocument(noReceipt).valid, true); assert.equal(evaluatePracticeEligibility({ assignmentDocument: noReceipt }).eligible, false);
});

test('partial, duplicate, sparse, unknown and fabricated detailed coverage are rejected', () => {
  const valid = detailed().approval.reviewedFieldPaths;
  for (const paths of [undefined, null, [], valid.slice(1), [...valid, valid[0]], [...valid.slice(1), '/sources/0/originalText'], Array(valid.length)]) {
    const d = detailed(); d.approval.reviewedFieldPaths = paths; assert.equal(validateApprovalEvidence(d).valid, false);
  }
});

test('mixed methods, malformed dates, mismatched revision and missing acknowledgement cannot authorize', () => {
  for (const patch of [{ method: 'unknown' }, { contentRevision: 2 }, { contentRevision: '1' }, { acceptedAt: 'not-a-date' }, { acceptedAt: '1' },
    { acceptedAt: '2026-02-30T00:00:00Z' }, { acceptedAt: '2026-11-11T24:00:00Z' }, { riskAcknowledgementVersion: true },
    { riskAcknowledgementVersion: 2 }, { riskAcknowledgementVersion: undefined }, { reviewedFieldPaths: ['/vocabulary/0/term'] }, { extra: true }]) {
    const d = bulk(); Object.assign(d.approval, patch); assert.equal(validateApprovalEvidence(d).valid, false, JSON.stringify(patch));
  }
  for (const value of [null, true, [], 'receipt', {}]) { const d = bulk(); d.approval = value; assert.equal(validateApprovalEvidence(d).valid, false); }
  const d = detailed(); d.approval.riskAcknowledgementVersion = 1; assert.equal(validateApprovalEvidence(d).valid, false);
  const pending = bulk(); pending.assignment.reviewStatus = 'pending_review'; assert.equal(validateApprovalEvidence(pending).valid, false);
  for (const date of ['2026-11-11T01:02:03Z', '2026-11-11T01:02:03.123Z', '2026-11-11T01:02:03+01:00']) { const b = bulk(); b.approval.acceptedAt = date; assert.equal(validateApprovalEvidence(b).valid, true); }
});

test('known gaps are derived; optional omissions are not invented as missing teacher content', () => {
  const d = detailed(); assert.equal(assessDetailedReviewReadiness(d.assignment).ready, true);
  delete d.assignment.vocabulary[0].definitionFr;
  const readiness = assessDetailedReviewReadiness(d.assignment);
  assert.deepEqual(readiness.gaps, [{ path: '/vocabulary/0/definitionFr', code: 'missing_definition' }]);
  d.approval.reviewedFieldPaths = readiness.fieldPaths; assert.equal(validateApprovalEvidence(d).valid, false);
  const empty = { schemaVersion: 1, id: 'empty', title: 'Empty', grade: 4, language: 'fr', reviewStatus: 'approved' };
  assert.equal(assessDetailedReviewReadiness(empty).ready, false);
  const grammarOnly = detailed(); grammarOnly.assignment.vocabulary = []; grammarOnly.approval.reviewedFieldPaths = enumerateEducationalFields(grammarOnly.assignment).map(f => f.path);
  assert.equal(validateApprovalEvidence(grammarOnly).valid, true); // Missing optional grammar explanations are not asserted to be gaps.
});

test('independent practice is not gated by review completeness or invalid acceptance evidence', () => {
  const policy = { policyVersion: 1, revision: 1, practiceMode: 'allow_independent_practice', riskAcknowledgementVersion: 1 };
  const d = bulk(); d.approval = { method: 'reviewed', contentRevision: 1, acceptedAt: 'invalid' };
  assert.equal(evaluatePracticeEligibility({ assignmentDocument: d, householdPolicy: policy }).reason, 'household_independent_policy');
  assert.equal(evaluatePracticeEligibility({ assignmentDocument: d }).eligible, false);
  d.writeRevision = null; assert.equal(evaluatePracticeEligibility({ assignmentDocument: d, householdPolicy: policy }).eligible, false);
});

test('safe bulk approval cannot invent questions when missing or supplementary content is unusable', () => {
  const d = bulk(); d.assignment.vocabulary = d.assignment.vocabulary.slice(0, 2); delete d.assignment.vocabulary[0].definitionFr;
  assert.equal(validateApprovalEvidence(d).valid, true);
  const before = JSON.stringify(d);
  assert.deepEqual(generateVocabularyQuestions(d.assignment, { approval: d.approval }).questions, []);
  assert.equal(JSON.stringify(d), before);
});
