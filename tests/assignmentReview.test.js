const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { enumerateEducationalFields } = require('../src/core/assignments/educationalFields');
const { validateApprovalEvidence, getWriteRevision } = require('../src/core/assignments/assignmentDocument');
const { applyFieldReview, applyMarkAllReviewed, applyParentCorrections } = require('../src/core/assignments/assignmentReview');
const clone = value => JSON.parse(JSON.stringify(value));
function document() { return { storageVersion: 1, contentRevision: 1, purpose: 'household_assignment', assignment: { ...clone(fixture), id: 'lesson' }, approval: null }; }
const correction = { fieldPath: '/vocabulary/0/term', text: 'un meneur', correctionExplanation: 'Parent correction for this test.' };
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function accepted() {
  const d = applyMarkAllReviewed(document(), { expectedWriteRevision: 0, confirmReviewDeclaration: true }).document;
  d.assignment.reviewStatus = 'approved';
  d.approval = { method: 'reviewed', contentRevision: 1, acceptedAt: '2026-11-11T00:00:00Z', reviewedFieldPaths: enumerateEducationalFields(d.assignment).map(f => f.path) };
  return d;
}

test('withdrawing review clears detailed evidence, preserves bulk acceptance and leaves content/source unchanged', () => {
  for (const bulk of [false, true]) {
    const d = accepted();
    if (bulk) d.approval = { method: 'bulk_risk_acknowledged', contentRevision: 1, acceptedAt: '2026-11-12T00:00:00Z', riskAcknowledgementVersion: 1 };
    freeze(d);
    const next = applyFieldReview(d, { expectedWriteRevision: 1, fieldPaths: ['/vocabulary/0/term'], reviewed: false }).document;
    assert.equal(next.writeRevision, 2); assert.equal(next.contentRevision, 1);
    assert.equal(next.assignment.vocabulary[0].term.provenance.reviewStatus, 'pending_review');
    assert.deepEqual(next.assignment.sources, d.assignment.sources);
    assert.equal(next.assignment.vocabulary[0].term.text, d.assignment.vocabulary[0].term.text);
    assert.equal(next.assignment.reviewStatus, bulk ? 'approved' : 'pending_review');
    assert.equal(validateApprovalEvidence(next).valid, bulk);
    assert.deepEqual(next.approval, bulk ? d.approval : null);
    const noOp = applyFieldReview(next, { expectedWriteRevision: 2, fieldPaths: ['/vocabulary/0/term'], reviewed: false });
    assert.equal(noOp.changed, false); assert.equal(noOp.document.writeRevision, 2);
    assert.throws(() => applyFieldReview(next, { expectedWriteRevision: 1, fieldPaths: ['/vocabulary/0/term'], reviewed: false }), { code: 'stale_document' });
  }
});

test('field review copies frozen input and only updates selected status and write revision', () => {
  const d = freeze(document()); const before = JSON.stringify(d);
  const { document: next, changed } = applyFieldReview(d, { expectedWriteRevision: 0, fieldPaths: ['/vocabulary/0/term'] });
  assert.equal(changed, true); assert.equal(next.writeRevision, 1); assert.equal(next.contentRevision, 1);
  assert.equal(next.assignment.vocabulary[0].term.provenance.reviewStatus, 'approved');
  assert.equal(next.assignment.vocabulary[0].definitionFr.provenance.reviewStatus, 'pending_review');
  assert.equal(next.assignment.reviewStatus, 'pending_review'); assert.equal(next.approval, null);
  assert.notEqual(next.assignment.sources, d.assignment.sources); assert.equal(JSON.stringify(d), before);
  assert.equal(validateApprovalEvidence(next).valid, false);
});

test('Mark All requires declaration, covers all fields and never creates assignment approval', () => {
  for (const value of [false, undefined, 'true', 1]) assert.throws(() => applyMarkAllReviewed(document(), { expectedWriteRevision: 0, confirmReviewDeclaration: value }), { code: 'confirmation_required' });
  const next = applyMarkAllReviewed(document(), { expectedWriteRevision: 0, confirmReviewDeclaration: true }).document;
  assert.ok(enumerateEducationalFields(next.assignment).every(f => f.provenance.reviewStatus === 'approved'));
  assert.equal(next.assignment.reviewStatus, 'pending_review'); assert.equal(next.approval, null);
  assert.equal(next.writeRevision, 1); assert.equal(next.contentRevision, 1);
  const unchanged = applyMarkAllReviewed(next, { expectedWriteRevision: 1, confirmReviewDeclaration: true });
  assert.equal(unchanged.changed, false); assert.deepEqual(unchanged.document, next); assert.notEqual(unchanged.document, next);
  assert.throws(() => applyMarkAllReviewed(next, { expectedWriteRevision: 0, confirmReviewDeclaration: true }), { code: 'stale_document' });
});

test('review progress preserves a valid bulk receipt and never relabels it detailed', () => {
  const d = document(); d.assignment.reviewStatus = 'approved';
  d.approval = { method: 'bulk_risk_acknowledged', contentRevision: 1, acceptedAt: '2026-11-11T00:00:00Z', riskAcknowledgementVersion: 1 };
  const next = applyMarkAllReviewed(d, { expectedWriteRevision: 0, confirmReviewDeclaration: true }).document;
  assert.deepEqual(next.approval, d.approval); assert.equal(validateApprovalEvidence(next).valid, true);
});

test('reviewing cannot resurrect an invalid detailed receipt into assignment approval', () => {
  const d = accepted(); d.assignment.vocabulary[0].term.provenance.reviewStatus = 'pending_review';
  assert.equal(validateApprovalEvidence(d).valid, false);
  const next = applyFieldReview(d, { expectedWriteRevision: 1, fieldPaths: ['/vocabulary/0/term'] }).document;
  assert.equal(next.approval, null); assert.equal(next.assignment.reviewStatus, 'pending_review');
  assert.equal(validateApprovalEvidence(next).valid, false); assert.equal(next.contentRevision, 1); assert.equal(next.writeRevision, 2);
});

test('material batch preserves original sources, identities and Unicode while resetting only changed fields', () => {
  const d = freeze(accepted()); const before = JSON.stringify(d);
  const next = applyParentCorrections(d, { expectedWriteRevision: 1, corrections: [
    { ...correction, text: '  ne\u0301gociateur  ', correctionExplanation: '  Parent retained exact Unicode.  ' },
    { fieldPath: '/grammarConcepts/0/examples/0/adverb', text: 'prudemment', correctionExplanation: 'Parent confirmed current spelling.' },
  ] }).document;
  assert.equal(next.contentRevision, 2); assert.equal(next.writeRevision, 2); assert.equal(next.approval, null);
  assert.equal(next.assignment.reviewStatus, 'pending_review');
  assert.deepEqual(enumerateEducationalFields(next.assignment).filter(f => f.provenance.reviewStatus === 'pending_review').map(f => f.path),
    ['/vocabulary/0/term', '/grammarConcepts/0/examples/0/adverb']);
  assert.equal(next.assignment.vocabulary[0].term.text, '  ne\u0301gociateur  ');
  assert.equal(next.assignment.vocabulary[0].term.provenance.correctionExplanation, '  Parent retained exact Unicode.  ');
  assert.equal(next.assignment.vocabulary[0].term.provenance.origin, 'parent_corrected');
  assert.deepEqual(next.assignment.sources, d.assignment.sources);
  assert.deepEqual(next.assignment.vocabulary.map(v => v.id), d.assignment.vocabulary.map(v => v.id));
  assert.equal(JSON.stringify(d), before); assert.equal(validateApprovalEvidence(next).valid, false);
});

test('mixed material/no-op batch preserves exact reviewed and pending metadata on unchanged fields', () => {
  let d = applyParentCorrections(accepted(), { expectedWriteRevision: 1, corrections: [correction] }).document;
  d = applyMarkAllReviewed(d, { expectedWriteRevision: 2, confirmReviewDeclaration: true }).document;
  d.assignment.vocabulary[2].definitionFr.provenance.reviewStatus = 'pending_review';
  const before = enumerateEducationalFields(d.assignment); freeze(d);
  const next = applyParentCorrections(d, { expectedWriteRevision: 3, corrections: [correction,
    { fieldPath: '/vocabulary/1/term', text: 'un autre négociateur', correctionExplanation: 'Only this field changes.' }] }).document;
  const after = enumerateEducationalFields(next.assignment);
  for (const field of before) if (field.path !== '/vocabulary/1/term') assert.deepEqual(after.find(f => f.path === field.path), field);
  assert.equal(next.assignment.vocabulary[0].term.provenance.reviewStatus, 'approved');
  assert.equal(next.assignment.vocabulary[1].term.provenance.reviewStatus, 'pending_review');
  assert.equal(next.assignment.vocabulary[2].definitionFr.provenance.reviewStatus, 'pending_review');
  assert.equal(next.contentRevision, 3); assert.equal(next.writeRevision, 4);
  assert.deepEqual(next.assignment.sources, d.assignment.sources);
});

test('provenance-only correction resets that field without resetting unchanged related definition', () => {
  const d = accepted(); const field = d.assignment.vocabulary[0].term;
  field.provenance.correctionExplanation = 'Same explanation.';
  freeze(d);
  const next = applyParentCorrections(d, { expectedWriteRevision: 1, corrections: [{ fieldPath: '/vocabulary/0/term', text: field.text, correctionExplanation: 'Same explanation.' }] }).document;
  assert.equal(next.assignment.vocabulary[0].term.text, field.text);
  assert.equal(next.assignment.vocabulary[0].term.provenance.origin, 'parent_corrected');
  assert.equal(next.assignment.vocabulary[0].term.provenance.reviewStatus, 'pending_review');
  assert.deepEqual(next.assignment.vocabulary[0].definitionFr, d.assignment.vocabulary[0].definitionFr);
  assert.equal(next.contentRevision, 2); assert.equal(next.writeRevision, 2); assert.equal(next.approval, null);
});

test('supplementary corrections retain original classification, authorship and source fidelity', () => {
  for (const origin of ['ai_generated', 'illustrative']) {
    const d = document(); const p = d.assignment.vocabulary[0].term.provenance;
    p.origin = origin; p.authorship = 'ai'; p.sourceIds = [];
    const next = applyParentCorrections(freeze(d), { expectedWriteRevision: 0, corrections: [correction] }).document;
    assert.equal(next.assignment.vocabulary[0].term.provenance.origin, origin);
    assert.equal(next.assignment.vocabulary[0].term.provenance.authorship, 'ai');
    assert.equal(next.assignment.vocabulary[0].term.provenance.correctionExplanation, correction.correctionExplanation);
    assert.deepEqual(next.assignment.sources, d.assignment.sources);
  }
  const d = document(); d.assignment.vocabulary[0].term.provenance.authorship = 'ai';
  assert.equal(applyParentCorrections(d, { expectedWriteRevision: 0, corrections: [correction] }).document.assignment.vocabulary[0].term.provenance.authorship, 'ai');
});

test('exact correction no-op retains reviews, evidence and both counters; explanation change resets', () => {
  let d = applyParentCorrections(document(), { expectedWriteRevision: 0, corrections: [correction] }).document;
  d = applyMarkAllReviewed(d, { expectedWriteRevision: 1, confirmReviewDeclaration: true }).document;
  d.assignment.reviewStatus = 'approved'; d.approval = { method: 'bulk_risk_acknowledged', contentRevision: 2, acceptedAt: '2026-11-11T00:00:00Z', riskAcknowledgementVersion: 1 };
  const result = applyParentCorrections(freeze(d), { expectedWriteRevision: 2, corrections: [correction] });
  assert.equal(result.changed, false); assert.deepEqual(result.document, d); assert.notEqual(result.document, d);
  assert.throws(() => applyParentCorrections(d, { expectedWriteRevision: 1, corrections: [correction] }), { code: 'stale_document' });
  const changed = applyParentCorrections(d, { expectedWriteRevision: 2, corrections: [{ ...correction, correctionExplanation: 'A new explanation.' }] });
  assert.equal(changed.document.contentRevision, 3); assert.equal(changed.document.writeRevision, 3); assert.equal(changed.document.approval, null);
  assert.equal(enumerateEducationalFields(changed.document.assignment).filter(f => f.provenance.reviewStatus === 'approved').length, 19);
});

test('invalid correction batches cannot partly apply, create fields, alter sources or traverse arbitrary keys', () => {
  const d = freeze(document()); const before = JSON.stringify(d);
  const invalid = [undefined, [], Array(1), [null], [{ ...correction, text: ' \t' }], [{ ...correction, correctionExplanation: '' }],
    [{ ...correction, correctionExplanation: undefined }], [correction, correction], [{ ...correction, sourceIds: [] }],
    [{ ...correction, fieldPath: '/sources/0/originalText' }], [{ ...correction, fieldPath: '/vocabulary/0/exampleSentences/0' }],
    [{ ...correction, fieldPath: '/__proto__/polluted' }], [{ ...correction, fieldPath: '/vocabulary/0/id' }], [correction, { ...correction, fieldPath: '/missing' }]];
  for (const corrections of invalid) assert.throws(() => applyParentCorrections(d, { expectedWriteRevision: 0, corrections }));
  for (const fieldPaths of [[], Array(1), ['/sources/0/originalText'], ['/vocabulary/0/term', '/vocabulary/0/term'], ['/vocabulary/0/definitionEn']]) {
    assert.throws(() => applyFieldReview(d, { expectedWriteRevision: 0, fieldPaths }), { code: 'invalid_field' });
  }
  assert.equal(JSON.stringify(d), before); assert.equal(Object.prototype.polluted, undefined);
});

test('counter overflow fails atomically and no-op does not consume a revision', () => {
  const d = document(); d.writeRevision = Number.MAX_SAFE_INTEGER;
  assert.throws(() => applyParentCorrections(d, { expectedWriteRevision: d.writeRevision, corrections: [correction] }), { code: 'revision_overflow' });
  assert.throws(() => applyFieldReview(d, { expectedWriteRevision: d.writeRevision, fieldPaths: ['/vocabulary/0/term'] }), { code: 'revision_overflow' });
  d.contentRevision = Number.MAX_SAFE_INTEGER; d.writeRevision = 1;
  assert.throws(() => applyParentCorrections(d, { expectedWriteRevision: 1, corrections: [correction] }), { code: 'revision_overflow' });
  assert.equal(d.assignment.vocabulary[0].term.text, fixture.vocabulary[0].term.text);
  const reviewed = accepted(); reviewed.writeRevision = Number.MAX_SAFE_INTEGER;
  assert.equal(applyMarkAllReviewed(reviewed, { expectedWriteRevision: reviewed.writeRevision, confirmReviewDeclaration: true }).changed, false);
});

test('empty Mark All is an independent no-op, never an acceptance or legacy migration', () => {
  const d = document(); d.assignment.vocabulary = []; d.assignment.grammarConcepts = [];
  const next = applyMarkAllReviewed(d, { expectedWriteRevision: 0, confirmReviewDeclaration: true });
  assert.equal(next.changed, false); assert.equal(getWriteRevision(next.document), 0); assert.equal(next.document.approval, null);
});
