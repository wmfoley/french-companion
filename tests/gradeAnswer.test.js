const test = require('node:test');
const assert = require('node:assert/strict');
const { gradeAnswer } = require('../src/core/exercises/gradeAnswer');

test('accepts the correct spelling', () => {
  assert.equal(gradeAnswer('crise', 'crise').isCorrect, true);
});

test('rejects incorrect spelling with a mistake category', () => {
  assert.deepEqual(gradeAnswer('crize', 'crise'), {
    response: 'crize', isCorrect: false, mistake: 'incorrect_spelling',
  });
});

test('ignores case in both answers', () => {
  assert.equal(gradeAnswer('NÉGOCIATEUR', 'négociateur').isCorrect, true);
  assert.equal(gradeAnswer('crise', 'CRISE').isCorrect, true);
});

test('ignores surrounding whitespace and preserves the original response', () => {
  const response = ' \tnégociateur\n';
  assert.deepEqual(gradeAnswer(response, ' négociateur '), {
    response, isCorrect: true, mistake: null,
  });
});

test('rejects missing, added, and different accents', () => {
  assert.equal(gradeAnswer('negociateur', 'négociateur').isCorrect, false);
  assert.equal(gradeAnswer('crisé', 'crise').isCorrect, false);
  assert.equal(gradeAnswer('nègociateur', 'négociateur').isCorrect, false);
});

test('equates canonical Unicode forms in either answer', () => {
  assert.equal(gradeAnswer('ne\u0301gociateur', 'négociateur').isCorrect, true);
  assert.equal(gradeAnswer('négociateur', 'ne\u0301gociateur').isCorrect, true);
});

test('preserves internal whitespace and punctuation distinctions', () => {
  assert.equal(gradeAnswer('une  crise', 'une crise').isCorrect, false);
  assert.equal(gradeAnswer('crise!', 'crise').isCorrect, false);
});

test('rejects non-string inputs rather than coercing them', () => {
  assert.throws(() => gradeAnswer(null, 'crise'), TypeError);
  assert.throws(() => gradeAnswer('crise', undefined), TypeError);
});
