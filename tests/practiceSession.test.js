const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { generateVocabularyQuestions } = require('../src/core/exercises/vocabularyMultipleChoice');
const { createSession, submitAnswer, advanceSession, summarizeSession } = require('../src/core/sessions/practiceSession');
const questions = generateVocabularyQuestions(fixture, { mode: 'demo', development: true }).questions;
const first = questions[0];
const wrong = first.optionItemIds.filter(id => id !== first.targetItemId);

test('first attempt success completes once and awards a first-attempt point', () => {
  const initial = createSession(questions);
  const session = submitAnswer(initial, first, first.targetItemId);
  assert.equal(session.responses[first.id].outcome, 'correct_first_attempt');
  assert.equal(summarizeSession(session).correctFirstAttempt, 1);
  assert.equal(submitAnswer(session, first, wrong[0]), session);
  assert.deepEqual(initial.responses, {});
});

test('wrong first attempt allows retry but cannot advance or repeat wrong selection', () => {
  const session = submitAnswer(createSession(questions), first, wrong[0]);
  assert.equal(session.responses[first.id].outcome, null);
  assert.equal(advanceSession(session), session);
  assert.equal(submitAnswer(session, first, wrong[0]), session);
  assert.equal(session.responses[first.id].attempts.length, 1);
  assert.equal(summarizeSession(session).completed, 0);
});

test('second attempt success is stored separately and does not earn first-attempt credit', () => {
  let session = submitAnswer(createSession(questions), first, wrong[0]);
  session = submitAnswer(session, first, first.targetItemId);
  assert.equal(session.responses[first.id].outcome, 'correct_second_attempt');
  assert.equal(summarizeSession(session).correctFirstAttempt, 0);
  assert.equal(summarizeSession(session).correctSecondAttempt, 1);
});

test('two distinct wrong attempts finish the question without allowing a third', () => {
  let session = submitAnswer(createSession(questions), first, wrong[0]);
  session = submitAnswer(session, first, wrong[1]);
  assert.equal(session.responses[first.id].outcome, 'incorrect_after_two_attempts');
  assert.equal(summarizeSession(session).incorrectAfterTwoAttempts, 1);
  assert.equal(submitAnswer(session, first, first.targetItemId), session);
});

test('invalid options do not consume attempts; stale question events are ignored', () => {
  const initial = createSession(questions);
  assert.throws(() => submitAnswer(initial, first, 'missing'), TypeError);
  assert.deepEqual(initial.responses, {});
  assert.equal(submitAnswer(initial, questions[1], questions[1].targetItemId), initial);
  const completed = submitAnswer(initial, first, first.targetItemId);
  const advanced = advanceSession(completed, first.id);
  assert.equal(advanced.index, 1);
  assert.equal(advanceSession(advanced, first.id), advanced);
  assert.equal(submitAnswer(advanced, first, first.targetItemId), advanced);
});

test('full session records mixed outcomes, finishes, and restarts without persisted state', () => {
  const selected = questions.slice(0, 3);
  let session = createSession(selected);
  for (const [index, question] of selected.entries()) {
    const distractors = question.optionItemIds.filter(id => id !== question.targetItemId);
    if (index > 0) session = submitAnswer(session, question, distractors[0]);
    session = submitAnswer(session, question, index === 2 ? distractors[1] : question.targetItemId);
    session = advanceSession(session, question.id);
  }
  assert.equal(session.finished, true);
  assert.deepEqual(summarizeSession(session), { completed: 3, total: 3, correctFirstAttempt: 1, correctSecondAttempt: 1, incorrectAfterTwoAttempts: 1 });
  assert.equal(advanceSession(session), session);
  assert.equal(submitAnswer(session, first, first.targetItemId), session);
  assert.deepEqual(createSession(selected).responses, {});
  assert.ok(!JSON.stringify(session).includes('definitionFr'));
});

test('empty sessions finish safely; duplicate exercise IDs are rejected', () => {
  const empty = createSession([]);
  assert.equal(empty.finished, true);
  assert.equal(summarizeSession(empty).completed, 0);
  assert.equal(advanceSession(empty), empty);
  assert.throws(() => createSession([first, first]), TypeError);
});
