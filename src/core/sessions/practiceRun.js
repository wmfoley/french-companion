const { randomizePresentation } = require('./randomizePresentation');
const { createSession, submitAnswer, advanceSession } = require('./practiceSession');

// One screen's in-memory run. No storage, policy decisions or React dependencies.
function createPracticeRun({ questions, verify, random, onChange }) {
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
      publish(action());
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
        const presentation = randomizePresentation(questions, random);
        return { questions: presentation, session: createSession(presentation) };
      });
    },
    submit(expected, question, selected) {
      return perform(expected, () => ({ ...run, session: submitAnswer(run.session, question, selected) }));
    },
    advance(expected, questionId) {
      return perform(expected, () => ({ ...run, session: advanceSession(run.session, questionId) }));
    },
  };
}
module.exports = { createPracticeRun };
