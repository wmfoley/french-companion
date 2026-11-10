const { normalizeAssignment } = require('../assignments/normalizeAssignment');

const POLICY = 'multiple-choice-two-attempts-v1';
const comparison = text => text.normalize('NFC').trim().toLocaleLowerCase('fr-CA');
const teacherContent = field => field && ['teacher', 'parent_corrected'].includes(field.provenance.origin);

function shuffle(values, seed) {
  let state = seed >>> 0;
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateVocabularyQuestions(input, { mode = 'practice', development = false, seed = 42 } = {}) {
  const assignment = normalizeAssignment(input);
  if (!['practice', 'demo'].includes(mode) || !Number.isInteger(seed)) throw new TypeError('Invalid generation options.');
  // Development capability is supplied by the application build, never a route parameter.
  const demo = mode === 'demo' && development === true && assignment.id === 'grade4-reference-001' && assignment.reviewStatus === 'pending_review';
  if ((mode === 'demo' && !demo) || (!demo && assignment.reviewStatus !== 'approved')) {
    return { questions: [], diagnostics: [{ code: 'approval_required' }] };
  }
  const diagnostics = [];
  const candidates = assignment.vocabulary.filter(item => {
    const eligible = teacherContent(item.term) && teacherContent(item.definitionFr) &&
      (demo || [item.term, item.definitionFr].every(field => field.provenance.reviewStatus === 'approved'));
    if (!eligible) diagnostics.push({ itemId: item.id, code: 'ineligible_content' });
    return eligible;
  });
  const pool = candidates.filter(item => {
    const unique = candidates.filter(other => comparison(other.term.text) === comparison(item.term.text)).length === 1 &&
      candidates.filter(other => comparison(other.definitionFr.text) === comparison(item.definitionFr.text)).length === 1;
    if (!unique) diagnostics.push({ itemId: item.id, code: 'ambiguous_content' });
    return unique;
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const questions = [];
  for (const [index, target] of pool.entries()) {
    const prompt = comparison(target.definitionFr.text);
    const options = pool.filter(item => !prompt.includes(comparison(item.term.text)));
    if (!options.includes(target) || options.length < 3) {
      diagnostics.push({ itemId: target.id, code: 'insufficient_safe_options' });
      continue;
    }
    const distractors = shuffle(options.filter(item => item.id !== target.id), seed + index).slice(0, 2);
    questions.push({ schemaVersion: 1, id: `vocabulary-mc-${target.id}`, type: 'vocabulary_multiple_choice', assignmentId: assignment.id,
      targetItemId: target.id, optionItemIds: shuffle([target.id, ...distractors.map(item => item.id)], seed + index + 17), gradingPolicy: POLICY });
    if (questions.length === 5) break;
  }
  if (!questions.length) diagnostics.push({ code: 'no_questions' });
  return { questions, diagnostics };
}

function validateVocabularyQuestion(question, assignment) {
  if (!question || question.schemaVersion !== 1 || question.type !== 'vocabulary_multiple_choice' || question.gradingPolicy !== POLICY ||
    question.assignmentId !== assignment.id || typeof question.id !== 'string' || !question.id ||
    !Array.isArray(question.optionItemIds) || question.optionItemIds.length !== 3 || new Set(question.optionItemIds).size !== 3 ||
    !question.optionItemIds.includes(question.targetItemId)) throw new TypeError('Invalid vocabulary exercise.');
  const items = question.optionItemIds.map(id => assignment.vocabulary.find(item => item.id === id));
  if (items.some(item => !teacherContent(item?.term) || !teacherContent(item?.definitionFr)) ||
    new Set(items.map(item => comparison(item.term.text))).size !== 3 ||
    new Set(items.map(item => comparison(item.definitionFr.text))).size !== 3) throw new TypeError('Invalid exercise references.');
  const target = items.find(item => item.id === question.targetItemId);
  if (items.some(item => comparison(target.definitionFr.text).includes(comparison(item.term.text)))) throw new TypeError('Answer exposed in prompt.');
}

function resolveVocabularyQuestion(question, assignment) {
  validateVocabularyQuestion(question, assignment);
  const target = assignment.vocabulary.find(item => item.id === question.targetItemId);
  return { definition: target.definitionFr.text, correctTerm: target.term.text,
    options: question.optionItemIds.map(id => ({ id, text: assignment.vocabulary.find(item => item.id === id).term.text })) };
}

function gradeVocabularyChoice(question, selectedItemId) {
  if (!question.optionItemIds.includes(selectedItemId)) throw new TypeError('Invalid selection.');
  return { selectedItemId, isCorrect: selectedItemId === question.targetItemId };
}

module.exports = { generateVocabularyQuestions, validateVocabularyQuestion, resolveVocabularyQuestion, gradeVocabularyChoice };
