const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudentAssignmentList, assignmentStatus } = require('../src/services/studentAssignmentList');
const { createHouseholdService } = require('../src/services/householdService');
const { generateVocabularyQuestions } = require('../src/core/exercises/vocabularyMultipleChoice');
const { generateTypedVocabularyQuestions } = require('../src/core/exercises/typedVocabularyRecall');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const copy = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const item = (eligible = true) => ({ id: 'lesson-one', title: 'Une leçon', eligible, reason: eligible ? 'parent_accepted' : 'approval_required' });

test('status presentation follows service eligibility, not assignment approval or inferred preparation', () => {
  assert.match(assignmentStatus({ ...item(), reviewStatus: 'pending_review', requiresUnreviewedNotice: true }), /Prête.*pas encore revue/);
  assert.match(assignmentStatus(item(false)), /parent doit revoir/);
  assert.match(assignmentStatus({ eligible: false, reason: 'assignment_not_ready' }), /pas encore prête/);
  for (const reason of ['invalid_assignment', 'reference_demo_only', 'unknown', '__proto__']) assert.equal(typeof assignmentStatus({ eligible: false, reason }), 'string');
  assert.match(assignmentStatus({ eligible: false, reason: 'unknown' }), /pas disponible/);
});

test('list reads metadata only and publishes eligible and blocked assignments without parent commands', async () => {
  const data = [item(), { ...item(false), id: 'blocked-lesson' }]; let reads = 0;
  const list = createStudentAssignmentList({ service: { async listPracticeAssignments() { reads++; return data; } } });
  await list.enter();
  assert.equal(reads, 1); assert.equal(list.snapshot().status, 'ready');
  assert.deepEqual(list.snapshot().items.map(value => value.eligible), [true, false]);
  assert.deepEqual(Object.keys(list.snapshot().items[0]), ['id', 'title', 'eligible', 'explanation', 'reviewRequired']);
  data[0].title = 'Changed elsewhere'; assert.equal(list.snapshot().items[0].title, 'Une leçon');
});

test('Ask a Parent requires an explicitly blocked review-required service result', async () => {
  const rows = [
    { ...item(false) }, { ...item(), reason: 'approval_required' },
    ...['assignment_not_ready', 'invalid_assignment', 'reference_demo_only', 'unknown'].map(reason => ({ ...item(false), reason })),
    { ...item(false), eligible: undefined },
  ];
  const list = createStudentAssignmentList({ service: { async listPracticeAssignments() { return rows; } } });
  await list.enter();
  assert.deepEqual(list.snapshot().items.map(value => value.reviewRequired), [true, false, false, false, false, false, false]);
});

test('loading, empty, failure and retry clear stale eligibility and suppress raw errors', async () => {
  let pending = deferred(); const list = createStudentAssignmentList({ service: { listPracticeAssignments: () => pending.promise } });
  const first = list.enter(); assert.equal(list.snapshot().status, 'loading'); pending.resolve([item()]); await first;
  pending = deferred(); const retry = list.refresh(); assert.deepEqual(list.snapshot(), { status: 'loading', items: [] });
  pending.reject(new Error('private storage diagnostics')); await retry;
  assert.deepEqual(list.snapshot(), { status: 'error', items: [] });
  pending = deferred(); const empty = list.refresh(); pending.resolve([]); await empty;
  assert.deepEqual(list.snapshot(), { status: 'ready', items: [] });
});

test('later refresh wins when old asynchronous reads complete out of order', async () => {
  const old = deferred(); const current = deferred(); let reads = 0;
  const list = createStudentAssignmentList({ service: { listPracticeAssignments: () => (++reads === 1 ? old.promise : current.promise) } });
  const first = list.enter(); const second = list.refresh(); current.resolve([item(false)]); await second;
  old.resolve([item()]); await first;
  assert.equal(list.snapshot().items[0].eligible, false);
});

test('route exit and re-entry suppress old success and rejection without losing new data', async () => {
  for (const failure of [false, true]) {
    const old = deferred(); let reads = 0;
    const list = createStudentAssignmentList({ service: { listPracticeAssignments: () => ++reads === 1 ? old.promise : Promise.resolve([item(false)]) } });
    const first = list.enter(); list.leave(); await list.refresh(); assert.equal(reads, 1);
    await list.enter(); if (failure) old.reject(Error('late')); else old.resolve([item()]); await first;
    assert.equal(list.snapshot().status, 'ready'); assert.equal(list.snapshot().items[0].eligible, false);
  }
});

test('background pause invalidates reads and resume refresh uses current eligibility', async () => {
  const old = deferred(); let reads = 0;
  const list = createStudentAssignmentList({ service: { listPracticeAssignments: () => ++reads === 1 ? old.promise : Promise.resolve([item(false)]) } });
  const first = list.enter(); list.pause(); old.resolve([item()]); await first;
  assert.deepEqual(list.snapshot(), { status: 'loading', items: [] });
  await list.refresh(); assert.equal(list.snapshot().items[0].eligible, false);
});

test('subscriptions can detach without changing other subscribers or future reads', async () => {
  const list = createStudentAssignmentList({ service: { async listPracticeAssignments() { return []; } } });
  let notices = 0; const unsubscribe = list.subscribe(() => notices++);
  await list.enter(); assert.equal(notices, 2); unsubscribe(); await list.refresh(); assert.equal(notices, 2);
});

test('actual household policies control list and deep-link reads; parent operations stay protected and both exercise types generate', async () => {
  let state = null;
  const service = createHouseholdService({ store: { async read() { return copy(state); }, async update(mutate) { state = copy(mutate(copy(state))); return copy(state); } },
    credential: { valid: value => value?.test === true, create: async () => ({ test: true }), verify: async pin => pin === '123456' }, now: () => 1000 });
  await service.setup('123456', '123456');
  const assignment = copy(fixture); assignment.id = 'student-list-lesson'; await service.submitAssignment(assignment);
  const list = createStudentAssignmentList({ service }); await list.enter();
  assert.equal(list.snapshot().items[0].eligible, false);
  assert.equal((await service.readPractice(assignment.id)).document, undefined);
  await assert.rejects(service.listParentAssignments({}), /locked/);
  const token = await service.unlock('123456');
  await service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  await list.refresh(); assert.equal(list.snapshot().items[0].eligible, true);
  const allowed = await service.readPractice(assignment.id);
  assert.equal(allowed.document.assignment.reviewStatus, 'pending_review'); assert.equal(allowed.document.approval, null);
  assert.ok(generateVocabularyQuestions(allowed.document.assignment, { householdPolicy: allowed.policy }).questions.length);
  assert.ok(generateTypedVocabularyQuestions(allowed.document, { householdPolicy: allowed.policy }).questions.length);
  await service.setPracticePolicy(token, { expectedRevision: 2, practiceMode: 'require_parent_approval' });
  await list.refresh(); assert.equal(list.snapshot().items[0].eligible, false);
  assert.equal((await service.readPractice(assignment.id)).document, undefined);
});
