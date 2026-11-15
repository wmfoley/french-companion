const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { generateTypedVocabularyQuestions } = require('../src/core/exercises/typedVocabularyRecall');
const { generateVocabularyQuestions } = require('../src/core/exercises/vocabularyMultipleChoice');
const { createSession, submitAnswer, advanceSession, summarizeSession, resolveSessionQuestion } = require('../src/core/sessions/practiceSession');
const { createPracticeRun } = require('../src/core/sessions/practiceRun');
const { randomizePresentation } = require('../src/core/sessions/randomizePresentation');
const { createHouseholdService } = require('../src/services/householdService');
const { createDevelopmentSample } = require('../src/content/developmentSample');
const clone = value => JSON.parse(JSON.stringify(value));
const TYPE = 'typed_vocabulary_recall';
const independent = { householdPolicy: { policyVersion: 1, revision: 1, practiceMode: 'allow_independent_practice', riskAcknowledgementVersion: 1 } };
function document() { return { storageVersion: 1, contentRevision: 1, writeRevision: 1, purpose: 'household_assignment', assignment: { ...clone(fixture), id: 'typed-lesson' }, approval: null }; }
function context(d = document(), options = independent) { return { exerciseType: TYPE, document: d, options: clone(options) }; }
function frozen(value) { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; }
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function harness(verify = async () => true, supplied = context()) {
  let run = null, draws = 0, changes = 0, value = 0, checks = 0;
  const questions = generateTypedVocabularyQuestions(supplied.document, supplied.options).questions;
  const controls = createPracticeRun({ questions, ...supplied, verify: async () => { checks++; return verify(); },
    random: () => { draws++; return value; }, onChange: next => { run = next; changes++; } });
  controls.enter();
  return { controls, questions, run: () => run, changes: () => changes, draws: () => draws, checks: () => checks,
    value: next => { value = next; }, term: q => supplied.document.assignment.vocabulary.find(x => x.id === q.targetItemId).term.text };
}
async function complete(h) {
  while (!h.run().session.finished) {
    const run = h.run(), q = run.questions[run.session.index];
    await h.controls.submit(run, q, h.term(q)); await h.controls.advance(h.run(), q.id);
  }
}

test('typed session initialization is explicit, reference-only, immutable and does not grade drafts', () => {
  const c = context(); const qs = frozen(generateTypedVocabularyQuestions(c.document, c.options).questions); const before = clone(c.document);
  const session = createSession(qs, c);
  assert.deepEqual(session, { questionIds: qs.map(q => q.id), index: 0, responses: {}, finished: false });
  assert.deepEqual(resolveSessionQuestion(session, qs[0], c), { definition: c.document.assignment.vocabulary.find(x => x.id === qs[0].targetItemId).definitionFr.text, feedback: null });
  assert.deepEqual(session.responses, {}); assert.deepEqual(c.document, before);
  assert.throws(() => createSession(qs), TypeError);
  assert.throws(() => createSession(qs, { ...c, exerciseType: 'other' }), TypeError);
  const mc = generateVocabularyQuestions(c.document.assignment, { householdPolicy: c.options.householdPolicy }).questions;
  assert.throws(() => createSession([...qs, ...mc], c), TypeError);
});

test('typed order shuffle copies frozen definitions, has no choice draws and rejects answer-bearing shapes', () => {
  const c = context(); const qs = frozen(generateTypedVocabularyQuestions(c.document, c.options).questions); const before = clone(qs);
  let draws = 0; const first = randomizePresentation(qs, () => { draws++; return 0; }, TYPE);
  assert.equal(draws, 4); assert.deepEqual(first, randomizePresentation(qs, () => 0, TYPE));
  assert.deepEqual(first.map(q => q.id).sort(), qs.map(q => q.id).sort()); assert.deepEqual(qs, before);
  for (const q of first) { assert.notEqual(q, qs.find(old => old.id === q.id)); assert.ok(!Object.hasOwn(q, 'optionItemIds')); }
  assert.deepEqual(randomizePresentation([], () => assert.fail(), TYPE), []);
  assert.deepEqual(randomizePresentation([qs[0]], () => assert.fail(), TYPE), [qs[0]]);
  for (const extra of [{ correctTerm: 'answer' }, { definition: 'text' }, { optionItemIds: [] }, { type: 'unknown' }]) {
    assert.throws(() => randomizePresentation([{ ...qs[0], ...extra }], () => 0, TYPE), TypeError);
  }
  assert.throws(() => randomizePresentation(qs, () => 1, TYPE), TypeError);
});

test('authorized typed Start and Replay draw exactly once and reset submitted responses', async () => {
  const gate = deferred(); let pending = gate; const h = harness(() => pending ? pending.promise : true);
  const start = h.controls.start(); assert.equal(h.draws(), 0); assert.equal(await h.controls.start(), false); assert.equal(h.checks(), 1);
  gate.resolve(true); pending = null; assert.equal(await start, true); assert.equal(h.draws(), 4);
  await complete(h); const old = h.run(); h.value(0.999);
  const replay = h.controls.start(); assert.equal(await h.controls.start(), false); assert.equal(await replay, true);
  assert.equal(h.draws(), 8); assert.notDeepEqual(h.run().questions, old.questions);
  assert.deepEqual(h.run().session.responses, {}); assert.equal(h.run().session.index, 0);
});

test('typed sessions preserve order through all outcomes, resolution reads and advancement', async () => {
  const h = harness(); await h.controls.start(); const order = h.run().questions; const before = clone(order);
  for (const [index, q] of order.entries()) {
    if (index > 0) await h.controls.submit(h.run(), q, 'incorrect');
    const prompt = h.controls.present(h.run(), q); assert.equal(prompt.feedback, null);
    await h.controls.submit(h.run(), q, index === 2 ? 'different incorrect' : h.term(q));
    assert.deepEqual(h.controls.present(h.run(), q).feedback, { correctTerm: h.term(q), definition: prompt.definition });
    assert.equal(h.run().questions, order); await h.controls.advance(h.run(), q.id);
    assert.deepEqual(order, before); assert.equal(h.draws(), 4);
  }
  assert.deepEqual(summarizeSession(h.run().session), { completed: 5, total: 5, correctFirstAttempt: 1, correctSecondAttempt: 3, incorrectAfterTwoAttempts: 1 });
});

test('blank/equivalent retries and incomplete advances are exact session/run no-ops', async () => {
  const h = harness(); await h.controls.start(); const q = h.run().questions[0], initial = h.run();
  assert.equal(await h.controls.submit(initial, q, ' \t'), false); assert.equal(h.run(), initial);
  await h.controls.submit(initial, q, 'réponse incorrecte'); const wrong = h.run(); const changes = h.changes();
  for (const answer of ['', 'RÉPONSE INCORRECTE ', 're\u0301ponse incorrecte']) {
    assert.equal(await h.controls.submit(wrong, q, answer), false); assert.equal(h.run(), wrong);
  }
  assert.equal(await h.controls.advance(wrong, q.id), false); assert.equal(h.changes(), changes);
  assert.equal(wrong.session.responses[q.id].attempts[0].response, 'réponse incorrecte');
  await h.controls.submit(wrong, q, h.term(q)); assert.equal(h.run().session.responses[q.id].outcome, 'correct_second_attempt');
  const done = h.run(); assert.equal(await h.controls.submit(done, q, 'third'), false); assert.equal(h.run(), done);
});

test('rapid duplicate Submit, stale run and forged question callbacks cannot consume retry', async () => {
  let pending = null; const h = harness(() => pending ? pending.promise : true); await h.controls.start();
  const run = h.run(), q = run.questions[0]; pending = deferred();
  const first = h.controls.submit(run, q, 'incorrect');
  assert.equal(await h.controls.submit(run, q, 'different'), false);
  assert.equal(await h.controls.submit(run, { ...q }, 'different'), false);
  pending.resolve(true); pending = null; assert.equal(await first, true);
  assert.equal(h.run().session.responses[q.id].attempts.length, 1);
  assert.equal(await h.controls.submit(run, q, 'different'), false);
  await h.controls.submit(h.run(), q, h.term(q)); const done = h.run(); await h.controls.advance(done, q.id);
  assert.equal(await h.controls.advance(done, q.id), false); assert.equal(h.run().session.index, 1);
});

test('denied or expired practice authorization never starts, grades, advances or replays', async () => {
  let allowed = false; const h = harness(() => allowed);
  assert.equal(await h.controls.start(), false); assert.equal(h.draws(), 0);
  allowed = true; await h.controls.start(); const initial = h.run(), q = initial.questions[0]; allowed = false;
  assert.equal(await h.controls.submit(initial, q, h.term(q)), false); assert.equal(h.run(), initial);
  allowed = true; await h.controls.submit(initial, q, h.term(q)); const answered = h.run(); allowed = false;
  assert.equal(await h.controls.advance(answered, q.id), false); assert.equal(h.run(), answered);
  allowed = true; await complete(h); const done = h.run(); allowed = false;
  assert.equal(await h.controls.start(), false); assert.equal(h.run(), done); assert.equal(h.draws(), 4);
});

test('late start and submit results cannot publish into a replacement visit or expose stale feedback', async () => {
  for (const operation of ['start', 'submit']) {
    let pending = null; const h = harness(() => pending ? pending.promise : true);
    if (operation === 'submit') await h.controls.start();
    const old = h.run(), q = old?.questions[0]; pending = deferred(); const oldGate = pending;
    const task = operation === 'start' ? h.controls.start() : h.controls.submit(old, q, 'incorrect');
    h.controls.leave(); assert.equal(h.controls.present(old, q), null); h.controls.enter(); pending = null;
    await h.controls.start(); const current = h.run(), changes = h.changes(); oldGate.resolve(true);
    assert.equal(await task, false); assert.equal(h.run(), current); assert.equal(h.changes(), changes); assert.deepEqual(current.session.responses, {});
    if (q) assert.equal(await h.controls.submit(old, q, 'incorrect'), false);
  }
});

test('old replay finalizer cannot release a newer pending start; rejection safely releases its own guard', async () => {
  let pending = null; const h = harness(() => pending ? pending.promise : true); await h.controls.start(); await complete(h);
  pending = deferred(); const oldGate = pending; const replay = h.controls.start(); h.controls.leave(); h.controls.enter();
  pending = deferred(); const nextGate = pending; const start = h.controls.start(); oldGate.resolve(true);
  assert.equal(await replay, false); assert.equal(await h.controls.start(), false);
  nextGate.reject(Error('read failed')); assert.equal(await start, false); pending = null;
  assert.equal(await h.controls.start(), true); assert.deepEqual(h.run().session.responses, {});
});

test('private grading snapshot and prompt presentation never publish expected terms or drafts before completion', async () => {
  const c = context(); const h = harness(async () => true, c); const before = clone(c.document); await h.controls.start();
  const run = h.run(), q = run.questions[0], term = h.term(q), prompt = h.controls.present(run, q);
  assert.deepEqual(Object.keys(run), ['questions', 'session']); assert.deepEqual(Object.keys(prompt), ['definition', 'feedback']);
  assert.equal(JSON.stringify(prompt).includes(term), false); assert.equal(JSON.stringify(run).includes('definitionFr'), false);
  assert.equal(Object.hasOwn(run.session, 'draft'), false); assert.deepEqual(run.session.responses, {});
  c.document.assignment.vocabulary.find(x => x.id === q.targetItemId).term.text = 'changed by caller'; c.options.householdPolicy.practiceMode = 'require_parent_approval';
  await h.controls.submit(run, q, term); assert.equal(h.run().session.responses[q.id].outcome, 'correct_first_attempt');
  assert.equal(h.controls.present(h.run(), q).feedback.correctTerm, term);
  assert.equal(before.assignment.sources[0].originalText, c.document.assignment.sources[0].originalText);
});

async function household() {
  let state = null, time = 1000;
  const store = { read: async () => clone(state), update: async mutate => { state = clone(mutate(clone(state))); return clone(state); } };
  const credential = { create: async () => ({ test: true }), valid: x => x?.test === true, verify: async () => true };
  const service = createHouseholdService({ store, credential, now: () => time, development: true, sampleProvider: createDevelopmentSample });
  await service.setup('123456', '123456'); await service.submitAssignment(document().assignment); const token = await service.unlock('123456');
  return { service, token, advance: ms => { time += ms; }, state: () => state };
}
function verifiedHouseholdRun(h, snapshot) {
  return harness(async () => {
    const latest = await h.service.readPractice(snapshot.document.assignment.id);
    return latest.eligibility.eligible && latest.document.contentRevision === snapshot.document.contentRevision;
  }, context(snapshot.document, { householdPolicy: snapshot.policy, development: true }));
}

test('actual household policy revocation blocks typed start/submit/advance and fresh independent re-entry resets responses', async () => {
  const h = await household(); await h.service.setPracticePolicy(h.token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  const snapshot = await h.service.readPractice('typed-lesson'), practice = verifiedHouseholdRun(h, snapshot);
  await h.service.setPracticePolicy(h.token, { expectedRevision: 2, practiceMode: 'require_parent_approval' });
  assert.equal(await practice.controls.start(), false);
  await h.service.setPracticePolicy(h.token, { expectedRevision: 3, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  await practice.controls.start(); const run = practice.run(), q = run.questions[0];
  await h.service.setPracticePolicy(h.token, { expectedRevision: 4, practiceMode: 'require_parent_approval' });
  assert.equal(await practice.controls.submit(run, q, practice.term(q)), false); assert.equal(await practice.controls.advance(run, q.id), false);
  assert.equal(practice.run(), run);
  await h.service.setPracticePolicy(h.token, { expectedRevision: 5, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  practice.controls.leave(); practice.controls.enter(); await practice.controls.start(); assert.deepEqual(practice.run().session.responses, {});
  assert.equal(h.state().assignments[0].approval, null); assert.equal(h.state().assignments[0].assignment.reviewStatus, 'pending_review');
});

test('assignment content revision invalidates active typed snapshots even under independent policy', async () => {
  const h = await household(); await h.service.setPracticePolicy(h.token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  const snapshot = await h.service.readPractice('typed-lesson'), practice = verifiedHouseholdRun(h, snapshot);
  await practice.controls.start(); const run = practice.run(), q = run.questions[0];
  await h.service.saveParentCorrections(h.token, { assignmentId: 'typed-lesson', expectedWriteRevision: 1,
    corrections: [{ fieldPath: '/vocabulary/0/term', text: 'un meneur', correctionExplanation: 'Parent correction.' }] });
  assert.equal((await h.service.readPractice('typed-lesson')).eligibility.eligible, true);
  assert.equal(await practice.controls.submit(run, q, practice.term(q)), false); assert.equal(await practice.controls.advance(run, q.id), false);
  assert.equal(practice.run(), run); practice.controls.leave(); practice.controls.enter(); assert.equal(await practice.controls.start(), false);
  const fresh = verifiedHouseholdRun(h, await h.service.readPractice('typed-lesson')); assert.equal(await fresh.controls.start(), true);
});

test('parent PIN inactivity expiry does not impose redundant authentication on independently permitted practice', async () => {
  const h = await household(); await h.service.setPracticePolicy(h.token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  const practice = verifiedHouseholdRun(h, await h.service.readPractice('typed-lesson')); await practice.controls.start(); h.advance(300000);
  await assert.rejects(h.service.getParentPolicy(h.token), /locked/);
  const run = practice.run(), q = run.questions[0]; assert.equal(await practice.controls.submit(run, q, practice.term(q)), true);
});

test('development demo/sample contexts retain exact build-only boundaries in session initialization', async () => {
  const d = document(); d.assignment = clone(fixture); const options = { mode: 'demo', development: true };
  const qs = generateTypedVocabularyQuestions(d, options).questions;
  assert.throws(() => createSession(qs, context(d, { mode: 'demo' })), TypeError);
  const demo = harness(async () => true, context(d, options)); await demo.controls.start(); assert.equal(demo.run().questions.length, 5);
  const h = await household(); const id = await h.service.loadDevelopmentSample(h.token);
  await h.service.setPracticePolicy(h.token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  const snapshot = await h.service.readPractice(id), practice = verifiedHouseholdRun(h, snapshot); await practice.controls.start();
  assert.equal(snapshot.document.purpose, 'development_sample');
  assert.throws(() => createSession(practice.run().questions, context(snapshot.document, { householdPolicy: snapshot.policy })), TypeError);
});

test('multiple-choice defaults retain option draws, two-attempt outcomes and safe optional presentation', async () => {
  const d = document(); const qs = generateVocabularyQuestions(d.assignment, { householdPolicy: independent.householdPolicy }).questions;
  let run, draws = 0; const controls = createPracticeRun({ questions: qs, document: d, verify: async () => true,
    random: () => { draws++; return 0; }, onChange: next => { run = next; } });
  controls.enter(); await controls.start(); assert.equal(draws, 14); const q = run.questions[0];
  assert.equal(controls.present(run, q).feedback, null); assert.equal(Object.hasOwn(controls.present(run, q), 'correctTerm'), false);
  const wrong = q.optionItemIds.find(id => id !== q.targetItemId); await controls.submit(run, q, wrong); await controls.submit(run, q, wrong);
  assert.equal(run.session.responses[q.id].attempts.length, 1); await controls.submit(run, q, q.targetItemId);
  assert.equal(run.session.responses[q.id].outcome, 'correct_second_attempt'); assert.ok(controls.present(run, q).feedback.correctTerm);
  assert.equal(draws, 14);
});

test('typed pure sessions retain frozen snapshot/state, ignore completed submissions and reject cross-question state use', () => {
  const c = context(), qs = generateTypedVocabularyQuestions(c.document, c.options).questions;
  const s = frozen(createSession(qs, c)); const wrong = submitAnswer(s, qs[0], 'incorrect', c);
  assert.equal(submitAnswer(wrong, qs[0], ' INCORRECT ', c), wrong); assert.equal(advanceSession(wrong), wrong);
  const done = submitAnswer(wrong, qs[0], 'different', c); assert.equal(done.responses[qs[0].id].outcome, 'incorrect_after_two_attempts');
  assert.equal(submitAnswer(done, qs[0], 'third', c), done); const next = advanceSession(done);
  assert.equal(submitAnswer(next, qs[0], 'stale', c), next); assert.throws(() => resolveSessionQuestion(next, qs[0], c), TypeError);
  assert.deepEqual(s.responses, {});
});
