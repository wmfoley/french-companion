const { gradeAnswer } = require('../core/exercises/gradeAnswer');

// Compare only with the student's previous response, never with the hidden expected term.
function canSubmitTypedDraft(draft, response, busy = false) {
  if (typeof draft !== 'string' || !draft.trim() || busy || response?.outcome) return false;
  const previous = response?.attempts?.at(-1);
  return !previous || !gradeAnswer(draft, previous.response).isCorrect;
}

module.exports = { canSubmitTypedDraft };
