const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAssignment } = require('../src/core/assignments/validateAssignment');
const { normalizeAssignment, normalizeTextForComparison } = require('../src/core/assignments/normalizeAssignment');

function assignment() {
  return { schemaVersion: 1, id: 'lesson-1', title: 'Lesson', grade: 4, language: 'fr-CA', reviewStatus: 'draft' };
}
function text(text = 'négociateur', origin = 'illustrative') {
  return { text, provenance: { origin, sourceIds: [], reviewStatus: 'draft', authorship: 'ai' } };
}
function withVocabulary() {
  return { ...assignment(), vocabulary: [{ id: 'term-1', term: text() }] };
}
function expectError(value, code, path) {
  const result = validateAssignment(value);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === code && (!path || error.path === path)), JSON.stringify(result.errors));
}

test('minimal assignments and all lifecycle statuses are structurally valid', () => {
  for (const reviewStatus of ['draft', 'pending_review', 'approved']) {
    assert.deepEqual(validateAssignment({ ...assignment(), reviewStatus }), { valid: true, errors: [] });
  }
});

test('rejects malformed root, versions, required fields, grades and unknown fields', () => {
  for (const value of [null, [], 'lesson', 4, new Date()]) expectError(value, 'expected_object');
  for (const [key, value, code] of [
    ['schemaVersion', 2, 'unsupported_schema_version'], ['id', 'Bad ID', 'invalid_id'],
    ['title', ' \n', 'expected_nonblank_text'], ['grade', 4.5, 'invalid_grade'],
    ['grade', 6, 'invalid_grade'], ['language', 'en', 'invalid_value'],
    ['reviewStatus', 'pending', 'invalid_value'], ['exercises', [], 'unknown_field'],
  ]) expectError({ ...assignment(), [key]: value }, code);
  const value = assignment();
  delete value.title;
  expectError(value, 'expected_nonblank_text', '$.title');
});

test('optional content can be absent, but supplied values must be well formed', () => {
  const value = withVocabulary();
  assert.equal(validateAssignment(value).valid, true);
  value.vocabulary[0].definitionFr = text(' \t');
  expectError(value, 'expected_nonblank_text', '$.vocabulary[0].definitionFr.text');
  value.vocabulary[0].definitionFr = null;
  expectError(value, 'expected_object');
  for (const key of ['sources', 'instructions', 'vocabulary', 'grammarConcepts', 'supportingMaterial']) {
    expectError({ ...assignment(), [key]: {} }, 'expected_array', `$.${key}`);
    expectError({ ...assignment(), [key]: [null] }, 'expected_object');
  }
});

test('teacher attribution requires resolvable non-illustrative evidence', () => {
  const value = withVocabulary();
  const p = value.vocabulary[0].term.provenance;
  p.origin = 'teacher';
  expectError(value, 'source_required');
  p.sourceIds = ['original'];
  expectError(value, 'unknown_source');
  value.sources = [{ id: 'original', reference: 'local worksheet', fidelity: 'illustrative', originalText: '' }];
  expectError(value, 'invalid_teacher_source');
  value.sources[0].fidelity = 'unverified_transcription';
  assert.equal(validateAssignment(value).valid, true);
});

test('parent corrections retain original evidence and require an explanation', () => {
  const value = withVocabulary();
  value.sources = [{ id: 'original', reference: 'local worksheet', fidelity: 'unverified_transcription', originalText: 'negociateur' }];
  const p = value.vocabulary[0].term.provenance;
  p.origin = 'parent_corrected';
  p.sourceIds = ['original'];
  expectError(value, 'expected_nonblank_text');
  p.correctionExplanation = 'Parent restored the accent after checking the worksheet.';
  const normalized = normalizeAssignment(value);
  assert.equal(normalized.sources[0].originalText, 'negociateur');
  assert.equal(normalized.vocabulary[0].term.text, 'négociateur');
  assert.deepEqual(normalized.vocabulary[0].term.provenance, p);
});

test('AI and illustrative origins are explicit and are never promoted by approval', () => {
  for (const origin of ['ai_generated', 'illustrative']) {
    const value = withVocabulary();
    value.reviewStatus = 'approved';
    value.vocabulary[0].term = text('Exemple', origin);
    expectError(value, 'unreviewed_content');
    value.vocabulary[0].term.provenance.reviewStatus = 'approved';
    assert.equal(normalizeAssignment(value).vocabulary[0].term.provenance.origin, origin);
  }
  const value = withVocabulary();
  delete value.vocabulary[0].term.provenance.authorship;
  expectError(value, 'required');
  value.vocabulary[0].term.provenance.origin = 'unknown';
  expectError(value, 'invalid_value');
});

test('rejects duplicate IDs, duplicate references, malformed provenance and sources', () => {
  const value = withVocabulary();
  value.vocabulary.push({ id: 'term-1', term: text() });
  expectError(value, 'duplicate_id');
  value.sources = [
    { id: 'source-1', reference: 'PRD', fidelity: 'reported_teacher_content', originalText: '' },
    { id: 'source-1', reference: 'PRD', fidelity: 'reported_teacher_content', originalText: '' },
  ];
  expectError(value, 'duplicate_id');
  value.vocabulary[0].term.provenance.sourceIds = ['source-1', 'source-1'];
  expectError(value, 'duplicate_reference');
  value.sources[0].originalText = 42;
  expectError(value, 'expected_string');
  value.sources[0].fidelity = 'parent_approved';
  expectError(value, 'invalid_value');
  value.vocabulary[0].term.provenance = null;
  expectError(value, 'expected_object');
});

test('validates grammar examples, instructions and supplementary notes', () => {
  const value = assignment();
  value.instructions = [{ id: 'instruction-1', content: text('Consigne illustrative') }];
  value.grammarConcepts = [{ id: 'grammar-1', label: text('-emment'), examples: [{ id: 'example-1', adjective: text('patient'), adverb: text('patiemment') }] }];
  value.supportingMaterial = [{ id: 'note-1', kind: 'note', content: text('Note illustrative') }];
  assert.equal(validateAssignment(value).valid, true);
  value.grammarConcepts[0].examples[0].adverb = text(' ');
  expectError(value, 'expected_nonblank_text');
  value.instructions[0].content.text = '';
  expectError(value, 'expected_nonblank_text', '$.instructions[0].content.text');
});

test('supports optional calendar dates without assuming a quiz weekday', () => {
  const value = { ...assignment(), week: { label: 'Week one', startDate: '2026-11-09', quizDate: '2026-11-12' } };
  assert.equal(validateAssignment(value).valid, true);
  for (const invalid of ['2026-02-30', '2026-13-01', 'tomorrow', 42, null]) {
    value.week.quizDate = invalid;
    expectError(value, 'invalid_date');
  }
});

test('supporting asset references are local and cannot traverse directories', () => {
  const value = { ...assignment(), supportingMaterial: [{ id: 'asset-1', kind: 'local_asset', content: text('Image illustrative'), assetPath: 'assets/lessons/example.png' }] };
  assert.equal(validateAssignment(value).valid, true);
  for (const path of ['https://example.com/a.png', '../a.png', 'assets/../a.png', 'C:\\a.png', 'assets/..']) {
    value.supportingMaterial[0].assetPath = path;
    expectError(value, 'invalid_local_asset_path');
  }
});

test('normalization supplies collections, preserves data, and creates independent copies', () => {
  const value = withVocabulary();
  value.vocabulary[0].term.text = ' \tne\u0301gociateur\n';
  value.sources = [{ id: 'raw', reference: 'PRD', fidelity: 'reported_teacher_content', originalText: ' \tne\u0301gociateur\r\n' }];
  const before = JSON.stringify(value);
  Object.freeze(value);
  const normalized = normalizeAssignment(value);
  assert.equal(JSON.stringify(value), before);
  assert.equal(normalized.sources[0].originalText, value.sources[0].originalText);
  assert.equal(normalized.vocabulary[0].term.text, value.vocabulary[0].term.text);
  assert.deepEqual(normalized.instructions, []);
  assert.deepEqual(normalized.vocabulary[0].exampleSentences, []);
  assert.deepEqual(normalizeAssignment(normalized), normalized);
  normalized.vocabulary[0].term.provenance.sourceIds.push('changed');
  assert.deepEqual(value.vocabulary[0].term.provenance.sourceIds, []);
});

test('source excerpts can be empty or whitespace-only without repair', () => {
  for (const originalText of ['', ' \r\n\t']) {
    const value = { ...assignment(), sources: [{ id: 'raw', reference: 'local', fidelity: 'unverified_transcription', originalText }] };
    assert.equal(normalizeAssignment(value).sources[0].originalText, originalText);
  }
});

test('NFC comparison preserves accents, case and whitespace distinctions', () => {
  assert.equal(normalizeTextForComparison('ne\u0301gociateur'), 'négociateur');
  assert.notEqual(normalizeTextForComparison('negociateur'), 'négociateur');
  assert.equal(normalizeTextForComparison(' NÉGOCIATEUR '), ' NÉGOCIATEUR ');
  assert.throws(() => normalizeTextForComparison(null), TypeError);
});

test('normalization rejects invalid assignments with structured errors', () => {
  assert.throws(() => normalizeAssignment({}), error => error instanceof TypeError && error.errors.some(e => e.code === 'unsupported_schema_version'));
});

test('rejects sparse arrays and explicit undefined optional fields', () => {
  expectError({ ...assignment(), vocabulary: new Array(1) }, 'expected_object');
  expectError({ ...assignment(), week: undefined }, 'expected_json_value');
});

test('rejects malformed text provenance fields and nested collections', () => {
  const value = withVocabulary();
  const p = value.vocabulary[0].term.provenance;
  p.sourceIds = null;
  expectError(value, 'expected_array');
  p.sourceIds = [];
  p.reviewStatus = 'pending';
  expectError(value, 'invalid_value');
  p.reviewStatus = 'draft';
  p.origin = 'ai_generated';
  p.authorship = 'human';
  expectError(value, 'invalid_value');
  p.authorship = 'ai';
  value.vocabulary[0].exampleSentences = [text(' \n')];
  expectError(value, 'expected_nonblank_text');
  value.grammarConcepts = [{ id: 'grammar-1', label: text('Rule'), examples: {} }];
  expectError(value, 'expected_array');
});

test('normalization defaults grammar examples without inventing explanations', () => {
  const value = { ...assignment(), grammarConcepts: [{ id: 'grammar-1', label: text('-emment') }] };
  const normalized = normalizeAssignment(value);
  assert.deepEqual(normalized.grammarConcepts[0].examples, []);
  assert.equal(Object.hasOwn(normalized.grammarConcepts[0], 'explanationFr'), false);
  assert.deepEqual(normalizeAssignment(normalized), normalized);
});
