const { randomizePresentation } = require('./randomizePresentation');
const { createSession, submitAnswer, advanceSession, resolveSessionQuestion } = require('./practiceSession');

// One screen's in-memory run. No storage, policy decisions or React dependencies.
function createPracticeRun({ questions, verify, random, onChange, exerciseType = 'vocabulary_multiple_choice', document, options }) {
  if (!['vocabulary_multiple_choice', 'typed_vocabulary_recall'].includes(exerciseType)) throw new TypeError('Unsupported run exercise type.');
  // Grading context stays private and independent of caller mutations; never publish it with a run.
  const context = { exerciseType, document: document === undefined ? undefined : JSON.parse(JSON.stringify(document)),
    options: JSON.parse(JSON.stringify(options ?? {})) };
  let active = false;
  let visit = 0;
  let pending = null;
  let run = null;
  function publish(next) { run = next; onChange(next); }
  async function perform(expected, action) {
    if (!active || pending || run !== expected) return false;
    const operation = { visit };
    pending = operation;
    try {
      if (!await verify() || !active || visit !== operation.visit || pending !== operation || run !== expected) return false;
      const next = action();
      if (next === run) return false;
      publish(next);
      return true;
    } catch { return false; }
    finally { if (pending === operation) pending = null; }
  }
  return {
    enter() { active = true; visit++; pending = null; publish(null); },
    leave() { active = false; visit++; pending = null; run = null; },
    start() {
      if (run && !run.session.finished) return Promise.resolve(false);
      return perform(run, () => {
        // Called once after authorization, never in render or a state updater.
        const presentation = randomizePresentation(questions, random, exerciseType);
        return { questions: presentation, session: createSession(presentation, context) };
      });
    },
    submit(expected, question, selected) {
      if (!run || run.questions[run.session.index] !== question) return Promise.resolve(false);
      return perform(expected, () => {
        const session = submitAnswer(run.session, question, selected, context);
        return exerciseType === 'typed_vocabulary_recall' && session === run.session ? run : { ...run, session };
      });
    },
    advance(expected, questionId) {
      return perform(expected, () => {
        const session = advanceSession(run.session, questionId);
        return exerciseType === 'typed_vocabulary_recall' && session === run.session ? run : { ...run, session };
      });
    },
    present(expected, question) {
      if (!active || run !== expected || !run || run.questions[run.session.index] !== question) return null;
      return resolveSessionQuestion(run.session, question, context);
    },
  };
}
module.exports = { createPracticeRun };
