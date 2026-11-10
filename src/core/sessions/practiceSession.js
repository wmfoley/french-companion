const { gradeVocabularyChoice } = require('../exercises/vocabularyMultipleChoice');

function createSession(questions) {
  if (!Array.isArray(questions) || new Set(questions.map(q => q.id)).size !== questions.length) throw new TypeError('Invalid session questions.');
  return { questionIds: questions.map(q => q.id), index: 0, responses: {}, finished: questions.length === 0 };
}

function submitAnswer(session, question, selectedItemId) {
  if (session.finished || session.questionIds[session.index] !== question.id) return session;
  const response = session.responses[question.id] || { attempts: [], outcome: null };
  if (response.outcome || response.attempts.some(attempt => attempt.selectedItemId === selectedItemId)) return session;
  const attempt = gradeVocabularyChoice(question, selectedItemId);
  const attempts = [...response.attempts, attempt];
  const outcome = attempt.isCorrect ? (attempts.length === 1 ? 'correct_first_attempt' : 'correct_second_attempt') :
    attempts.length === 2 ? 'incorrect_after_two_attempts' : null;
  return { ...session, responses: { ...session.responses, [question.id]: { attempts, outcome } } };
}

function advanceSession(session, expectedQuestionId = session.questionIds[session.index]) {
  if (session.finished || expectedQuestionId !== session.questionIds[session.index] || !session.responses[session.questionIds[session.index]]?.outcome) return session;
  if (session.index === session.questionIds.length - 1) return { ...session, finished: true };
  return { ...session, index: session.index + 1 };
}

function summarizeSession(session) {
  const outcomes = Object.values(session.responses).map(response => response.outcome);
  return { completed: outcomes.filter(Boolean).length, total: session.questionIds.length,
    correctFirstAttempt: outcomes.filter(value => value === 'correct_first_attempt').length,
    correctSecondAttempt: outcomes.filter(value => value === 'correct_second_attempt').length,
    incorrectAfterTwoAttempts: outcomes.filter(value => value === 'incorrect_after_two_attempts').length };
}

module.exports = { createSession, submitAnswer, advanceSession, summarizeSession };
