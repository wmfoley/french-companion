const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { generateVocabularyQuestions: generate, validateVocabularyQuestion, resolveVocabularyQuestion, gradeVocabularyChoice } = require('../src/core/exercises/vocabularyMultipleChoice');

function approvedAssignment() {
  const value = JSON.parse(JSON.stringify(fixture));
  function approve(object) {
    if (!object || typeof object !== 'object') return;
    if (Object.hasOwn(object, 'reviewStatus')) object.reviewStatus = 'approved';
    Object.values(object).forEach(approve);
  }
  approve(value);
  return value;
}

test('normal practice requires approval and demo requires explicit development capability', () => {
  assert.equal(generate(fixture).questions.length, 0);
  assert.equal(generate(fixture, { mode: 'demo' }).questions.length, 0);
  assert.equal(generate(fixture, { mode: 'demo', development: false }).questions.length, 0);
  assert.equal(generate(fixture, { mode: 'demo', development: true }).questions.length, 5);
  assert.equal(generate({ ...fixture, id: 'another-assignment' }, { mode: 'demo', development: true }).questions.length, 0);
  assert.equal(generate({ ...fixture, reviewStatus: 'draft' }, { mode: 'demo', development: true }).questions.length, 0);
  assert.equal(generate(approvedAssignment()).questions.length, 5);
});

test('generation preserves fixture, review status, sources and educational wording', () => {
  const before = JSON.stringify(fixture);
  generate(fixture, { mode: 'demo', development: true });
  assert.equal(JSON.stringify(fixture), before);
  assert.equal(fixture.reviewStatus, 'pending_review');
});

test('questions are deterministic ID references with three options and varied correct positions', () => {
  const assignment = approvedAssignment();
  const first = generate(assignment, { seed: 42 });
  assert.deepEqual(generate(assignment, { seed: 42 }), first);
  assert.notDeepEqual(generate(assignment, { seed: 123 }).questions, first.questions);
  assert.ok(new Set(first.questions.map(q => q.optionItemIds.indexOf(q.targetItemId))).size > 1);
  for (const question of first.questions) {
    assert.equal(validateVocabularyQuestion(question, assignment), undefined);
    assert.equal(question.optionItemIds.length, 3);
    assert.equal(new Set(question.optionItemIds).size, 3);
    assert.equal(question.prompt, undefined);
    assert.equal(question.correctAnswer, undefined);
    const resolved = resolveVocabularyQuestion(question, assignment);
    const original = assignment.vocabulary.find(v => v.id === question.targetItemId);
    assert.equal(resolved.definition, original.definitionFr.text);
    assert.equal(resolved.correctTerm, original.term.text);
  }
});

test('invalid assignments, options and exercise references are rejected', () => {
  assert.throws(() => generate({}), TypeError);
  assert.throws(() => generate(fixture, { seed: 1.5 }), TypeError);
  assert.throws(() => generate(fixture, { mode: 'unknown' }), TypeError);
  const assignment = approvedAssignment();
  const question = generate(assignment).questions[0];
  for (const override of [ { schemaVersion: 2 }, { type: 'unknown' }, { gradingPolicy: 'unknown' }, { assignmentId: 'wrong' },
    { optionItemIds: ['missing', question.targetItemId, 'other'] }, { optionItemIds: [question.targetItemId, question.targetItemId, question.targetItemId] } ]) {
    assert.throws(() => validateVocabularyQuestion({ ...question, ...override }, assignment), TypeError);
  }
  assert.throws(() => gradeVocabularyChoice(question, 'missing'), TypeError);
});

test('grading compares stable option IDs without string grading or accent removal', () => {
  const assignment = approvedAssignment();
  const question = generate(assignment).questions[0];
  assert.equal(gradeVocabularyChoice(question, question.targetItemId).isCorrect, true);
  assert.equal(gradeVocabularyChoice(question, question.optionItemIds.find(id => id !== question.targetItemId)).isCorrect, false);
  assert.throws(() => gradeVocabularyChoice(question, question.targetItemId.toUpperCase()), TypeError);
});

test('missing definitions and supplementary content are skipped without fabrication', () => {
  const assignment = approvedAssignment();
  delete assignment.vocabulary[0].definitionFr;
  assignment.vocabulary[1].term.provenance.origin = 'ai_generated';
  const result = generate(assignment);
  assert.equal(result.questions.length, 3);
  assert.equal(result.diagnostics.filter(d => d.code === 'ineligible_content').length, 2);
  assert.ok(result.questions.every(q => !q.optionItemIds.includes(assignment.vocabulary[0].id) && !q.optionItemIds.includes(assignment.vocabulary[1].id)));
});

test('empty or two-entry pools yield graceful diagnostics', () => {
  for (const count of [0, 1, 2]) {
    const assignment = approvedAssignment();
    assignment.vocabulary = assignment.vocabulary.slice(0, count);
    const result = generate(assignment);
    assert.deepEqual(result.questions, []);
    assert.ok(result.diagnostics.some(d => d.code === 'no_questions'));
  }
});

test('duplicate terms and duplicate definitions are excluded including Unicode equivalents', () => {
  const assignment = approvedAssignment();
  assignment.vocabulary[0].term.text = ' UN NE\u0301GOCIATEUR ';
  const result = generate(assignment);
  assert.equal(result.diagnostics.filter(d => d.code === 'ambiguous_content').length, 2);
  assert.equal(result.questions.length, 3);
  assignment.vocabulary[2].definitionFr.text = assignment.vocabulary[3].definitionFr.text;
  assert.equal(generate(assignment).questions.length, 0);
});

test('accent distinctions remain distinct and parent-corrected fields retain provenance', () => {
  const assignment = approvedAssignment();
  assignment.vocabulary[0].term.text = 'un negociateur';
  assignment.vocabulary[0].term.provenance.origin = 'parent_corrected';
  assignment.vocabulary[0].term.provenance.correctionExplanation = 'Illustrative test correction.';
  assert.equal(generate(assignment).questions.length, 5);
  assert.equal(assignment.vocabulary[0].term.provenance.origin, 'parent_corrected');
});

test('prompts exposing a target answer are skipped and unsafe distractors omitted', () => {
  const assignment = approvedAssignment();
  assignment.vocabulary[0].definitionFr.text = 'Voici un dirigeant.';
  const result = generate(assignment);
  assert.ok(!result.questions.some(q => q.targetItemId === assignment.vocabulary[0].id));
  assert.ok(result.diagnostics.some(d => d.itemId === assignment.vocabulary[0].id && d.code === 'insufficient_safe_options'));
});

module.exports = { approvedAssignment };
