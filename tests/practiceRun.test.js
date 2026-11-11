const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { generateVocabularyQuestions } = require('../src/core/exercises/vocabularyMultipleChoice');
const { summarizeSession } = require('../src/core/sessions/practiceSession');
const { createPracticeRun } = require('../src/core/sessions/practiceRun');
const questions = generateVocabularyQuestions(fixture, { mode: 'demo', development: true }).questions;
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness(verify = async () => true) {
  let snapshot = null; let draws = 0; let value = 0; let checks = 0; let changes = 0;
  const controls = createPracticeRun({ questions, verify: () => { checks++; return verify(); },
    random: () => { draws++; return value; }, onChange: next => { snapshot = next; changes++; } });
  controls.enter();
  return { controls, run: () => snapshot, draws: () => draws, checks: () => checks, changes: () => changes, value: next => { value = next; } };
}
async function complete(h) {
  while (!h.run().session.finished) {
    const run = h.run(); const question = run.questions[run.session.index];
    await h.controls.submit(run, question, question.targetItemId);
    await h.controls.advance(h.run(), question.id);
  }
}

test('start draws only after authorization; repeated taps cannot replace the active run', async () => {
  const pending = deferred(); const h = harness(() => pending.promise);
  const start = h.controls.start();
  assert.equal(h.draws(), 0);
  assert.equal(await h.controls.start(), false);
  assert.equal(h.checks(), 1);
  pending.resolve(true); assert.equal(await start, true);
  const run = h.run(); assert.equal(h.draws(), 14);
  assert.equal(await h.controls.start(), false);
  assert.equal(h.run(), run); assert.equal(h.draws(), 14);
});

test('presentation remains identical through all outcomes, retry and completion', async () => {
  const h = harness(); await h.controls.start();
  const presentation = h.run().questions; const before = JSON.stringify(presentation);
  assert.deepEqual(h.run().session.questionIds, presentation.map(q => q.id));
  for (const [index, question] of presentation.entries()) {
    const wrong = question.optionItemIds.filter(id => id !== question.targetItemId);
    if (index > 0) await h.controls.submit(h.run(), question, wrong[0]);
    if (index > 0) {
      const retry = h.run();
      await h.controls.advance(retry, question.id);
      assert.equal(h.run().session.index, index);
      await h.controls.submit(h.run(), question, wrong[0]);
      assert.equal(h.run().session.responses[question.id].attempts.length, 1);
    }
    await h.controls.submit(h.run(), question, index === 2 ? wrong[1] : question.targetItemId);
    await h.controls.advance(h.run(), question.id);
    assert.equal(h.run().questions, presentation);
    assert.equal(JSON.stringify(presentation), before);
    assert.equal(h.draws(), 14);
  }
  assert.deepEqual(summarizeSession(h.run().session), { completed: 5, total: 5, correctFirstAttempt: 1, correctSecondAttempt: 3, incorrectAfterTwoAttempts: 1 });
});

test('replay creates one fresh presentation and clears responses; duplicate replay is ignored', async () => {
  const h = harness(); await h.controls.start(); await complete(h);
  const old = h.run(); h.value(0.999);
  const replay = h.controls.start();
  assert.equal(await h.controls.start(), false);
  assert.equal(await replay, true);
  assert.notEqual(h.run().questions, old.questions);
  assert.notDeepEqual(h.run().questions, old.questions);
  assert.deepEqual(h.run().session.responses, {});
  assert.equal(h.run().session.index, 0); assert.equal(h.draws(), 28);
  assert.equal(questions[0].id, generateVocabularyQuestions(fixture, { mode: 'demo', development: true }).questions[0].id);
});

test('late start completion after leaving cannot publish or draw, even after re-entry', async () => {
  const old = deferred(); let first = true;
  const h = harness(() => { if (first) { first = false; return old.promise; } return true; });
  const stale = h.controls.start(); h.controls.leave(); h.controls.enter();
  await h.controls.start(); const current = h.run(); const changes = h.changes();
  old.resolve(true); assert.equal(await stale, false);
  assert.equal(h.run(), current); assert.equal(h.changes(), changes); assert.equal(h.draws(), 14);
});

test('unmount and rejected authorization settle safely; retry can succeed', async () => {
  const pending = deferred(); const h = harness(() => pending.promise);
  const start = h.controls.start(); h.controls.leave(); const changes = h.changes();
  pending.reject(Error('storage unavailable')); assert.equal(await start, false);
  assert.equal(h.changes(), changes); assert.equal(h.draws(), 0);
  const retry = harness(); await retry.controls.start(); assert.ok(retry.run());
});

test('denied start/replay/submit/advance do not change presentation or responses', async () => {
  let allowed = false; const h = harness(async () => allowed);
  assert.equal(await h.controls.start(), false); assert.equal(h.draws(), 0);
  allowed = true; await h.controls.start(); const run = h.run(); const question = run.questions[0];
  allowed = false;
  assert.equal(await h.controls.submit(run, question, question.targetItemId), false);
  assert.equal(await h.controls.advance(run, question.id), false); assert.equal(h.run(), run);
  allowed = true; await complete(h); const completed = h.run(); allowed = false;
  assert.equal(await h.controls.start(), false); assert.equal(h.run(), completed); assert.equal(h.draws(), 14);
});

test('late submit cannot update a newer visit, even with the same question IDs', async () => {
  let pending = null; const h = harness(() => pending ? pending.promise : true);
  await h.controls.start(); const old = h.run(); const question = old.questions[0]; pending = deferred();
  const submission = h.controls.submit(old, question, question.targetItemId);
  assert.equal(await h.controls.advance(old, question.id), false);
  h.controls.leave(); h.controls.enter(); const deferredSubmission = pending; pending = null;
  await h.controls.start(); const current = h.run();
  deferredSubmission.resolve(true); assert.equal(await submission, false);
  assert.equal(h.run(), current); assert.deepEqual(current.session.responses, {});
  assert.equal(await h.controls.submit(old, question, question.targetItemId), false);
});

test('late replay cannot publish or release a newer pending start after navigation', async () => {
  let pending = null; const h = harness(() => pending ? pending.promise : true);
  await h.controls.start(); await complete(h);
  pending = deferred(); const oldPending = pending; const replay = h.controls.start();
  h.controls.leave(); h.controls.enter(); pending = deferred();
  const currentStart = h.controls.start(); const changes = h.changes();
  oldPending.resolve(true); assert.equal(await replay, false);
  assert.equal(h.changes(), changes); assert.equal(await h.controls.start(), false);
  pending.resolve(true); assert.equal(await currentStart, true); assert.equal(h.draws(), 28);
});

test('authorization rejection releases the action guard for a subsequent attempt', async () => {
  let reject = true; const h = harness(async () => { if (reject) throw Error('read failed'); return true; });
  assert.equal(await h.controls.start(), false); assert.equal(h.draws(), 0);
  reject = false; assert.equal(await h.controls.start(), true); assert.equal(h.draws(), 14);
});
