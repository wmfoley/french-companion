const { gradeAnswer } = require('./gradeAnswer');
const { normalizeAssignment } = require('../assignments/normalizeAssignment');
const { validateAssignmentDocument } = require('../assignments/assignmentDocument');
const { evaluatePracticeEligibility } = require('../assignments/practiceEligibility');

const POLICY = 'typed-vocabulary-two-attempts-v1';
const TYPE = 'typed_vocabulary_recall';
const plain = value => Boolean(value && Object.getPrototypeOf(value) === Object.prototype);
const exactKeys = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const comparable = text => text.normalize('NFC').trim().toLocaleLowerCase('fr-CA').normalize('NFC');
const teacherContent = field => field && ['teacher', 'parent_corrected'].includes(field.provenance.origin);
const equivalent = (a, b) => gradeAnswer(a, b).isCorrect;

function leaksAnswer(term, definition) {
  const full = comparable(term);
  // Leakage detection only: never strip an article from the expected grading answer.
  const headword = full.replace(/^(?:(?:un|une|le|la)\s+|l['\u2019])/, '');
  const prompt = comparable(definition);
  return [full, headword].some(answer => {
    if (!answer) return true;
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^\\p{L}\\p{M}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{M}\\p{N}_])`, 'u').test(prompt);
  });
}

function eligibleContent(document, options = {}) {
  if (!plain(options) || Object.keys(options).some(key => !['mode', 'development', 'householdPolicy'].includes(key))) throw new TypeError('Invalid typed-recall options.');
  const { mode = 'practice', development = false, householdPolicy } = options;
  if (!['practice', 'demo'].includes(mode) || typeof development !== 'boolean') throw new TypeError('Invalid typed-recall options.');
  const validation = validateAssignmentDocument(document);
  if (!validation.valid) {
    const error = new TypeError('Invalid assignment document.'); error.errors = validation.errors; throw error;
  }
  const assignment = normalizeAssignment(document.assignment);
  const demo = mode === 'demo' && development && document.purpose === 'household_assignment' &&
    assignment.id === 'grade4-reference-001' && assignment.reviewStatus === 'pending_review';
  const eligibility = evaluatePracticeEligibility({ assignmentDocument: document, householdPolicy, development });
  if ((mode === 'demo' && !demo) || (!demo && !eligibility.eligible)) return { assignment, pool: [], diagnostics: [{ code: 'approval_required' }] };
  const diagnostics = [];
  const candidates = assignment.vocabulary.filter(item => {
    const eligible = teacherContent(item.term) && teacherContent(item.definitionFr);
    if (!eligible) diagnostics.push({ itemId: item.id, code: 'ineligible_content' });
    return eligible;
  });
  const pool = candidates.filter(item => {
    const unique = candidates.filter(other => equivalent(item.term.text, other.term.text)).length === 1 &&
      candidates.filter(other => equivalent(item.definitionFr.text, other.definitionFr.text)).length === 1;
    if (!unique) diagnostics.push({ itemId: item.id, code: 'ambiguous_content' });
    const safe = !leaksAnswer(item.term.text, item.definitionFr.text);
    if (!safe) diagnostics.push({ itemId: item.id, code: 'answer_leakage' });
    return unique && safe;
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { assignment, pool, diagnostics };
}

function generateTypedVocabularyQuestions(document, options) {
  const { assignment, pool, diagnostics } = eligibleContent(document, options);
  const questions = pool.slice(0, 5).map(item => ({ schemaVersion: 1, id: `vocabulary-recall-${item.id}`, type: TYPE,
    assignmentId: assignment.id, targetItemId: item.id, gradingPolicy: POLICY }));
  if (!questions.length) diagnostics.push({ code: 'no_questions' });
  return { questions, diagnostics };
}

function checkedTarget(question, document, options) {
  const { assignment, pool } = eligibleContent(document, options);
  if (!exactKeys(question, ['schemaVersion', 'id', 'type', 'assignmentId', 'targetItemId', 'gradingPolicy']) ||
    question.schemaVersion !== 1 || question.type !== TYPE || question.gradingPolicy !== POLICY || question.assignmentId !== assignment.id ||
    typeof question.targetItemId !== 'string' || question.id !== `vocabulary-recall-${question.targetItemId}`) throw new TypeError('Invalid typed-recall question.');
  const target = pool.find(item => item.id === question.targetItemId);
  if (!target) throw new TypeError('Typed-recall content is unavailable.');
  return target;
}
function validateTypedVocabularyQuestion(question, document, options) { checkedTarget(question, document, options); }
function resolveTypedVocabularyQuestion(question, document, options) {
  return { definition: checkedTarget(question, document, options).definitionFr.text };
}
function gradeTypedVocabularyAnswer(question, document, response, options) {
  const target = checkedTarget(question, document, options);
  if (typeof response !== 'string' || !response.trim()) throw new TypeError('A nonblank typed response is required.');
  return gradeAnswer(response, target.term.text);
}
function outcomeFor(attempts) {
  if (!attempts.length) return null;
  if (attempts.at(-1).isCorrect) return attempts.length === 1 ? 'correct_first_attempt' : 'correct_second_attempt';
  return attempts.length === 2 ? 'incorrect_after_two_attempts' : null;
}
function checkedResponse(state, question, target) {
  if (!exactKeys(state, ['questionId', 'attempts', 'outcome']) || state.questionId !== question.id ||
    !Array.isArray(state.attempts) || state.attempts.length > 2) throw new TypeError('Invalid typed-recall response state.');
  for (const [index, attempt] of Array.from(state.attempts).entries()) {
    if (!exactKeys(attempt, ['response', 'isCorrect', 'mistake']) || typeof attempt.response !== 'string' || !attempt.response.trim()) throw new TypeError('Invalid typed-recall attempt.');
    const actual = gradeAnswer(attempt.response, target.term.text);
    if (actual.isCorrect !== attempt.isCorrect || actual.mistake !== attempt.mistake ||
      (index === 0 && actual.isCorrect && state.attempts.length > 1) ||
      (index === 1 && equivalent(state.attempts[0].response, attempt.response))) throw new TypeError('Inconsistent typed-recall attempts.');
  }
  if (state.outcome !== outcomeFor(state.attempts)) throw new TypeError('Inconsistent typed-recall outcome.');
}
function createTypedVocabularyResponse(question, document, options) {
  checkedTarget(question, document, options);
  return { questionId: question.id, attempts: [], outcome: null };
}
function submitTypedVocabularyAnswer(state, question, document, response, options) {
  const target = checkedTarget(question, document, options);
  checkedResponse(state, question, target);
  if (typeof response !== 'string') throw new TypeError('Typed responses must be strings.');
  if (state.outcome || !response.trim() || state.attempts.some(attempt => equivalent(attempt.response, response))) return state;
  const attempts = [...state.attempts, gradeAnswer(response, target.term.text)];
  return { questionId: question.id, attempts, outcome: outcomeFor(attempts) };
}
function resolveTypedVocabularyFeedback(state, question, document, options) {
  const target = checkedTarget(question, document, options);
  checkedResponse(state, question, target);
  return state.outcome ? { correctTerm: target.term.text, definition: target.definitionFr.text } : null;
}

module.exports = { generateTypedVocabularyQuestions, validateTypedVocabularyQuestion, resolveTypedVocabularyQuestion,
  gradeTypedVocabularyAnswer, createTypedVocabularyResponse, submitTypedVocabularyAnswer, resolveTypedVocabularyFeedback };
