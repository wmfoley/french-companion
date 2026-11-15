const test = require('node:test');
const assert = require('node:assert/strict');
const corpus = require('./fixtures/preparation/corpus.json');
const { validatePreparation, assessPreparation, validatePreparationAssessment } = require('../src/core/preparation/preparationContract');
const { validateAssignment } = require('../src/core/assignments/validateAssignment');
const { validateAssignmentDocument, validateApprovalEvidence } = require('../src/core/assignments/assignmentDocument');
const { evaluatePracticeEligibility } = require('../src/core/assignments/practiceEligibility');
const reference = require('../src/content/fixtures/grade4-reference.json');
const copy = value => JSON.parse(JSON.stringify(value));
const sample = name => copy(corpus.cases.find(item => item.id === name).preparation);
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

for (const fixture of corpus.cases) test(`preparation corpus: ${fixture.id}`, () => {
  const input = freeze(copy(fixture.preparation));
  assert.deepEqual(validatePreparation(input), { valid: true, errors: [] });
  const result = assessPreparation(input);
  assert.equal(result.suitability, fixture.expected.suitability);
  assert.equal(result.ready, fixture.expected.ready);
  assert.equal(validatePreparationAssessment(input, result).valid, true);
});

test('source spans must match exactly, including Unicode composition, accents and whitespace', () => {
  const input = sample('accents-articles');
  const original = copy(input);
  assert.equal(assessPreparation(input).eligibleCandidateIds.length, 2);
  assert.deepEqual(input, original);
  input.candidates[0].fields.term.text = 'une e\u0301cole';
  assert.equal(validatePreparation(input).valid, false);
  const raw = sample('printed-list');
  raw.sources[0].text = '\r\n' + raw.sources[0].text;
  for (const region of raw.regions) { region.start += 2; region.end += 2; }
  for (const candidate of raw.candidates) for (const field of Object.values(candidate.fields)) { field.start += 2; field.end += 2; }
  assert.equal(validatePreparation(raw).valid, true);
  assert.ok(raw.sources[0].text.startsWith('\r\n'));
});

test('missing/null confidence stays unknown and numeric scores do not override statuses', () => {
  const input = sample('printed-list');
  input.reliability = { status: 'unknown', confidence: 1 };
  input.safety = { status: 'unknown', confidence: null };
  const result = assessPreparation(input);
  assert.equal(result.ready, false);
  assert.deepEqual(result.safety, { status: 'unknown', confidence: null });
  assert.equal(Object.hasOwn(input.candidates[0], 'confidence'), false);
  assert.ok(result.issues.some(issue => issue.code === 'unknown_candidate_confidence'));
  for (const value of [-1, 1.1, 'high', undefined, NaN, Infinity]) {
    input.reliability.confidence = value;
    assert.equal(validatePreparation(input).valid, false);
  }
});

test('association requires same declared pair region, never matching array positions', () => {
  const input = sample('printed-table');
  [input.candidates[0].fields.definitionFr, input.candidates[1].fields.definitionFr] = [input.candidates[1].fields.definitionFr, input.candidates[0].fields.definitionFr];
  assert.equal(validatePreparation(input).valid, false);
  const valid = sample('printed-table');
  const before = assessPreparation(valid).eligibleCandidateIds;
  valid.candidates.reverse();
  assert.deepEqual(assessPreparation(valid).eligibleCandidateIds, before.reverse());
  valid.candidates[0].association = { kind: 'unknown' };
  assert.equal(assessPreparation(valid).suitability, 'partial');
});

test('partial disclosure enumerates excluded candidates and preserves unsupported region references', () => {
  const input = sample('partial-sheet'); const result = assessPreparation(input);
  assert.deepEqual(result.eligibleCandidateIds, ['candidate-1']);
  assert.deepEqual(result.excludedCandidateIds, ['candidate-2']);
  assert.deepEqual(result.disclosure, { required: true, excludedCandidateIds: ['candidate-2'], regionIds: ['region-extra'] });
  assert.deepEqual(result.unsupportedRegions, [input.regions[2]]);
  result.unsupportedRegions[0].support = 'supported';
  assert.equal(input.regions[2].support, 'unsupported');
  assert.equal(validatePreparationAssessment(input, result).valid, false);
});

test('unresolved, uncovered and unreferenced educational regions cannot silently disappear', () => {
  const input = sample('printed-list');
  input.regions[0].support = 'unresolved';
  assert.deepEqual(assessPreparation(input).eligibleCandidateIds, ['candidate-2']);
  input.candidates.pop();
  assert.ok(assessPreparation(input).disclosure.regionIds.includes('region-2'));
  input.sources[0].text += 'Undisclosed homework';
  assert.equal(validatePreparation(input).valid, false);
});

test('duplicate normalized terms or definitions exclude all members; supplementary is excluded', () => {
  const input = sample('printed-table');
  input.candidates[0].origin = 'supplementary';
  assert.deepEqual(assessPreparation(input).excludedCandidateIds, ['candidate-1']);
  const duplicates = sample('duplicates');
  assert.equal(assessPreparation(duplicates).eligibleCandidateIds.length, 0);
  // Independently point both entries to the same exact source-backed definition.
  const repeated = sample('printed-list');
  repeated.candidates[1] = copy(repeated.candidates[0]); repeated.candidates[1].id = 'another-item';
  assert.equal(assessPreparation(repeated).eligibleCandidateIds.length, 0);
});

test('malformed contracts and unsupported versions fail without leaking source text in errors', () => {
  const mutations = [
    value => { value.schemaVersion = 2; }, value => { value.capture.revision = 0; },
    value => { value.preparation.revision = 1.5; }, value => { value.sources = null; },
    value => { value.regions[0].end = 99999; }, value => { value.candidates[0].fields.term.regionId = 'missing'; },
    value => { value.sources.push(copy(value.sources[0])); }, value => { value.regions.push(copy(value.regions[0])); },
    value => { value.candidates.push(copy(value.candidates[0])); }, value => { value.candidates[0].fields.term.text = ' '; },
    value => { value.candidates[0].fields = null; }, value => { value.safety.status = 'approved'; },
    value => { value.approval = { method: 'reviewed' }; }, value => { value.candidates[0].fields.term.provenance = { origin: 'teacher' }; },
    value => { value.candidates[0].association.kind = 'positional'; }, value => { value.candidates[0].confidence = undefined; },
    value => { value.candidates[0].kind = '__proto__'; }, value => { value.candidates[0].kind = 'constructor'; },
    value => { value.candidates[0].kind = { toString: 'not-a-function' }; },
  ];
  for (const mutate of mutations) {
    const input = sample('printed-list'); mutate(input);
    assert.equal(validatePreparation(input).valid, false);
    assert.throws(() => assessPreparation(input), { name: 'TypeError', message: 'Invalid preparation contract.' });
  }
  for (const input of [null, undefined, [], {}, 'approve', 1]) assert.equal(validatePreparation(input).valid, false);
});

test('result validation rejects fabricated readiness, disclosure, identities and approval keys', () => {
  const input = sample('partial-sheet');
  for (const mutate of [result => { result.schemaVersion = 2; }, result => { result.disclosure.required = false; }, result => { result.eligibleCandidateIds.push('candidate-2'); }, result => { result.capture.revision++; }, result => { result.approval = true; }]) {
    const result = assessPreparation(input); mutate(result);
    assert.equal(validatePreparationAssessment(input, result).valid, false);
  }
  const blocked = sample('unsafe-material'); const result = assessPreparation(blocked); result.ready = true;
  assert.equal(validatePreparationAssessment(blocked, result).valid, false);
  assert.equal(validatePreparationAssessment(null, {}).valid, false);
});

test('hostile text is preserved verbatim but cannot become commands or approval evidence', () => {
  const input = sample('embedded-instructions'); const before = copy(input);
  const result = assessPreparation(input);
  assert.deepEqual(input, before);
  assert.equal(result.ready, false);
  assert.equal(Object.hasOwn(result, 'approval'), false);
  assert.equal(Object.hasOwn(globalThis, 'approved'), false);
  input.parentCapability = 'scanned-parent-token';
  assert.equal(validatePreparation(input).valid, false);
});

test('preparation cannot replace assignment validation, approval or household policy', () => {
  const input = sample('printed-list'); const result = assessPreparation(input);
  assert.equal(result.ready, true);
  assert.equal(validateAssignment(result).valid, false);
  const assignment = copy(reference); const before = copy(assignment);
  const document = { storageVersion: 1, contentRevision: 1, writeRevision: 1, purpose: 'development_sample', assignment, approval: null };
  assert.equal(validateAssignmentDocument(document).valid, true);
  assert.equal(evaluatePracticeEligibility({ assignmentDocument: document, development: true }).eligible, false);
  assert.equal(evaluatePracticeEligibility({ assignmentDocument: document, development: false, householdPolicy: { policyVersion: 1, revision: 1, practiceMode: 'allow_independent_practice', riskAcknowledgementVersion: 1 } }).eligible, false);
  assessPreparation(input);
  assert.deepEqual(assignment, before);
  assert.equal(document.contentRevision, 1);
  assert.equal(document.approval, null);
});

test('empty evidence is valid as an unsupported, not-ready assessment, never fabricated content', () => {
  const input = sample('printed-list'); input.sources = []; input.regions = []; input.candidates = [];
  const result = assessPreparation(input);
  assert.equal(result.suitability, 'unsupported'); assert.equal(result.ready, false);
  assert.ok(result.issues.some(issue => issue.code === 'missing_evidence'));
});

test('existing pending household strict/independent and revision-bound bulk approval remain independent of preparation', () => {
  const assignment = copy(reference); assignment.id = 'household-compatibility-example';
  const document = { storageVersion: 1, contentRevision: 3, writeRevision: 7, purpose: 'household_assignment', assignment, approval: null };
  const independent = { policyVersion: 1, revision: 2, practiceMode: 'allow_independent_practice', riskAcknowledgementVersion: 1 };
  assert.equal(evaluatePracticeEligibility({ assignmentDocument: document }).eligible, false);
  assert.equal(evaluatePracticeEligibility({ assignmentDocument: document, householdPolicy: independent }).eligible, true);
  const before = copy(document); assessPreparation(sample('printed-table'));
  assert.deepEqual(document, before);
  assignment.reviewStatus = 'approved';
  document.approval = { method: 'bulk_risk_acknowledged', contentRevision: 3, acceptedAt: '2026-11-15T00:00:00Z', riskAcknowledgementVersion: 1 };
  assert.equal(validateApprovalEvidence(document).valid, true);
  assert.equal(evaluatePracticeEligibility({ assignmentDocument: document }).eligible, true);
  document.approval.contentRevision = 2;
  assert.equal(evaluatePracticeEligibility({ assignmentDocument: document }).eligible, false);
});

test('capture/preparation revisions are distinct, validated identities and do not mutate inputs', () => {
  const input = sample('printed-list'); input.capture.revision = 2; input.preparation.revision = 4;
  const result = assessPreparation(input);
  assert.equal(result.capture.revision, 2); assert.equal(result.preparation.revision, 4);
  result.capture.revision = 9;
  assert.equal(input.capture.revision, 2);
  for (const revision of [-1, 0, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = sample('printed-list'); invalid.preparation.revision = revision;
    assert.equal(validatePreparation(invalid).valid, false);
  }
});
