const { gradeVocabularyChoice, resolveVocabularyQuestion } = require('../exercises/vocabularyMultipleChoice');
const { validateTypedVocabularyQuestion, resolveTypedVocabularyQuestion, createTypedVocabularyResponse,
  submitTypedVocabularyAnswer, resolveTypedVocabularyFeedback } = require('../exercises/typedVocabularyRecall');

function exerciseType(context = {}) {
  const type = context.exerciseType ?? 'vocabulary_multiple_choice';
  if (!['vocabulary_multiple_choice', 'typed_vocabulary_recall'].includes(type)) throw new TypeError('Unsupported session exercise type.');
  return type;
}
function createSession(questions, context = {}) {
  if (!Array.isArray(questions) || new Set(questions.map(q => q.id)).size !== questions.length) throw new TypeError('Invalid session questions.');
  const type = exerciseType(context);
  for (const question of questions) {
    if (question.type !== undefined && question.type !== type) throw new TypeError('Session exercise type mismatch.');
    if (type === 'typed_vocabulary_recall') validateTypedVocabularyQuestion(question, context.document, context.options);
  }
  return { questionIds: questions.map(q => q.id), index: 0, responses: {}, finished: questions.length === 0 };
}

function submitAnswer(session, question, selectedItemId, context = {}) {
  if (session.finished || session.questionIds[session.index] !== question.id) return session;
  const type = exerciseType(context);
  if (question.type !== undefined && question.type !== type) throw new TypeError('Session exercise type mismatch.');
  if (type === 'typed_vocabulary_recall') {
    const previous = session.responses[question.id] || createTypedVocabularyResponse(question, context.document, context.options);
    const response = submitTypedVocabularyAnswer(previous, question, context.document, selectedItemId, context.options);
    return response === previous ? session : { ...session, responses: { ...session.responses, [question.id]: response } };
  }
  const response = session.responses[question.id] || { attempts: [], outcome: null };
  if (response.outcome || response.attempts.some(attempt => attempt.selectedItemId === selectedItemId)) return session;
  const attempt = gradeVocabularyChoice(question, selectedItemId);
  const attempts = [...response.attempts, attempt];
  const outcome = attempt.isCorrect ? (attempts.length === 1 ? 'correct_first_attempt' : 'correct_second_attempt') :
    attempts.length === 2 ? 'incorrect_after_two_attempts' : null;
  return { ...session, responses: { ...session.responses, [question.id]: { attempts, outcome } } };
}

// Student-facing resolution, separate from the private assignment/grading context.
function resolveSessionQuestion(session, question, context = {}) {
  if (session.questionIds[session.index] !== question.id) throw new TypeError('Not the current session question.');
  if (exerciseType(context) === 'typed_vocabulary_recall') {
    const prompt = resolveTypedVocabularyQuestion(question, context.document, context.options);
    const response = session.responses[question.id] || createTypedVocabularyResponse(question, context.document, context.options);
    return { ...prompt, feedback: resolveTypedVocabularyFeedback(response, question, context.document, context.options) };
  }
  const { definition, options, correctTerm } = resolveVocabularyQuestion(question, context.document.assignment);
  return { definition, options, feedback: session.responses[question.id]?.outcome ? { correctTerm, definition } : null };
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

module.exports = { createSession, submitAnswer, advanceSession, summarizeSession, resolveSessionQuestion };
