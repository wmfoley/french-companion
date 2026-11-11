const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { generateVocabularyQuestions, gradeVocabularyChoice } = require('../src/core/exercises/vocabularyMultipleChoice');
const { randomizePresentation } = require('../src/core/sessions/randomizePresentation');
const questions = generateVocabularyQuestions(fixture, { mode: 'demo', development: true }).questions;
const sequence = values => { let index = 0; return () => values[index++ % values.length]; };

test('injected randomness produces deterministic question and choice permutations', () => {
  const values = [0.2, 0.9, 0.1, 0.6, 0.4];
  const first = randomizePresentation(questions, sequence(values));
  assert.deepEqual(first, randomizePresentation(questions, sequence(values)));
  assert.notDeepEqual(first, randomizePresentation(questions, () => 0.999));
  assert.deepEqual(first.map(q => q.id).sort(), questions.map(q => q.id).sort());
  for (const question of first) {
    const original = questions.find(q => q.id === question.id);
    assert.deepEqual([...question.optionItemIds].sort(), [...original.optionItemIds].sort());
    assert.equal(new Set(question.optionItemIds).size, original.optionItemIds.length);
    assert.deepEqual({ ...question, optionItemIds: null }, { ...original, optionItemIds: null });
    for (const id of question.optionItemIds) assert.equal(gradeVocabularyChoice(question, id).isCorrect, id === original.targetItemId);
  }
});

test('frozen source questions and arrays remain unchanged and are independently copied', () => {
  const frozen = Object.freeze(questions.map(q => Object.freeze({ ...q, optionItemIds: Object.freeze([...q.optionItemIds]) })));
  const before = JSON.stringify(frozen);
  const result = randomizePresentation(frozen, () => 0);
  assert.equal(JSON.stringify(frozen), before);
  assert.notEqual(result, frozen);
  for (const question of result) {
    const original = frozen.find(q => q.id === question.id);
    assert.notEqual(question, original);
    assert.notEqual(question.optionItemIds, original.optionItemIds);
  }
  result[0].optionItemIds.reverse();
  assert.equal(JSON.stringify(frozen), before);
});

test('each question consumes separate choice draws before the question-order shuffle', () => {
  const input = ['one', 'two'].map(id => ({ id, optionItemIds: ['a', 'b', 'c'] }));
  // First choices rotate, second choices stay put, then question order stays put.
  const output = randomizePresentation(input, sequence([0, 0, 0.999, 0.999, 0.999]));
  assert.deepEqual(output, [{ id: 'one', optionItemIds: ['b', 'c', 'a'] }, { id: 'two', optionItemIds: ['a', 'b', 'c'] }]);
});

test('empty and single-question presentations are safe', () => {
  assert.deepEqual(randomizePresentation([], () => assert.fail('no draws')), []);
  const single = randomizePresentation([questions[0]], () => 0);
  assert.equal(single.length, 1);
  assert.equal(single[0].id, questions[0].id);
  assert.deepEqual([...single[0].optionItemIds].sort(), [...questions[0].optionItemIds].sort());
});

test('invalid random sources and malformed question inputs are rejected without mutation', () => {
  for (const value of [-1, 1, NaN, Infinity, undefined, '0.5']) {
    assert.throws(() => randomizePresentation(questions, () => value), TypeError);
  }
  assert.throws(() => randomizePresentation(null, Math.random), TypeError);
  assert.throws(() => randomizePresentation(questions), TypeError);
  assert.throws(() => randomizePresentation([{}], Math.random), TypeError);
});
