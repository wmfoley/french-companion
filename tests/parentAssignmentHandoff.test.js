const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { createHouseholdService } = require('../src/services/householdService');
const { createAssignmentReviewController } = require('../src/services/parent/assignmentReviewController');
const { createStudentAssignmentList } = require('../src/services/studentAssignmentList');
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

async function harness() {
  let state = null; let token = null; let time = 1000; let nextRead = null;
  const store = {
    async read() { const wait = nextRead; nextRead = null; const snapshot = clone(state); if (wait) await wait.promise; return snapshot; },
    async update(mutate) { state = clone(mutate(clone(state))); return clone(state); },
  };
  const service = createHouseholdService({ store, now: () => time,
    credential: { valid: value => value?.test === true, create: async () => ({ test: true }), verify: async pin => pin === '123456' } });
  await service.setup('123456', '123456');
  for (const id of ['handoff-one', 'handoff-two']) await service.submitAssignment({ ...clone(fixture), id });
  const controller = createAssignmentReviewController({ service, getCapability: () => token, onLocked: () => { token = null; } });
  return { service, controller, snapshot: () => clone(state),
    async unlock() { token = await service.unlock('123456'); return token; },
    lock() { service.lock(); token = null; controller.lock(); },
    deferRead(wait) { nextRead = wait; }, advance(ms) { time += ms; } };
}

test('context selection cannot load protected details before PIN authorization', async () => {
  const h = await harness(); let reads = 0;
  const read = h.service.readParentAssignment;
  h.service.readParentAssignment = (...args) => { reads++; return read(...args); };
  await h.controller.open('handoff-one');
  assert.equal(reads, 0); assert.equal(h.controller.snapshot().detail, null);
  await assert.rejects(h.service.readParentAssignment({}, { assignmentId: 'handoff-one' }), /locked/);
  assert.equal(h.controller.snapshot().detail, null);
});

test('authorized context selects current persisted assignment without approval or policy writes', async () => {
  const h = await harness(); await h.unlock(); const before = h.snapshot();
  await h.controller.open('handoff-two');
  assert.equal(h.controller.snapshot().detail.document.assignment.id, 'handoff-two');
  assert.equal(h.controller.snapshot().detail.document.approval, null);
  assert.deepEqual(h.snapshot(), before);
});

test('missing and malformed route IDs show a safe explanation and retain ordinary navigation', async () => {
  for (const id of ['missing-lesson', '', ['handoff-one', 'handoff-two'], '../parent', { approval: true }]) {
    const h = await harness(); await h.unlock(); await h.controller.open(id);
    assert.equal(h.controller.snapshot().detail, null);
    assert.match(h.controller.snapshot().message, /assignment is unavailable/);
    h.controller.navigate('home'); assert.equal(h.controller.snapshot().view, 'home');
    await h.controller.list(); assert.equal(h.controller.snapshot().list.length, 2);
  }
});

test('leaving during contextual read suppresses late detail and clears protected buffers', async () => {
  const h = await harness(); await h.unlock(); const wait = deferred(); h.deferRead(wait);
  const pending = h.controller.open('handoff-one'); h.lock(); wait.resolve(); await pending;
  assert.equal(h.controller.snapshot().detail, null);
  await h.unlock(); await h.controller.open('handoff-one');
  h.controller.editField('/vocabulary/0/term'); h.controller.changeEdit('text', 'Unsaved local edit');
  h.lock();
  assert.equal(h.controller.snapshot().edit, null); assert.equal(h.controller.snapshot().detail, null);
});

test('a late contextual response cannot replace another selected assignment or revoke a newer session', async () => {
  const h = await harness(); await h.unlock(); const wait = deferred(); h.deferRead(wait);
  const old = h.controller.open('handoff-one'); h.lock();
  const currentToken = await h.unlock(); await h.controller.open('handoff-two');
  wait.resolve(); await old;
  assert.equal(h.controller.snapshot().detail.document.assignment.id, 'handoff-two');
  assert.equal((await h.service.getParentPolicy(currentToken)).practiceMode, 'require_parent_approval');
});

test('expiry and background/exit locking require unlock and reread current revisions', async () => {
  const h = await harness(); await h.unlock(); await h.controller.open('handoff-one');
  h.advance(5 * 60 * 1000); await h.controller.open('handoff-two');
  assert.equal(h.controller.snapshot().detail, null);
  await h.unlock(); await h.controller.open('handoff-one');
  const revision = h.controller.snapshot().detail.writeRevision;
  h.lock(); // Existing route-exit/background callback, no session survives it.
  await h.controller.open('handoff-one'); assert.equal(h.controller.snapshot().detail, null);
  await h.unlock(); await h.controller.open('handoff-one');
  assert.equal(h.controller.snapshot().detail.writeRevision, revision);
});

test('return refresh reflects explicit approval, material correction and independent policy without changing review evidence', async () => {
  const h = await harness(); let token = await h.unlock();
  const list = createStudentAssignmentList({ service: h.service }); await list.enter();
  assert.equal(list.snapshot().items[0].reviewRequired, true);
  await h.controller.open('handoff-one');
  await h.service.approveWithoutDetailedReview(token, { assignmentId: 'handoff-one', expectedWriteRevision: 1, acknowledgeRisk: true, confirmAcceptance: true });
  h.lock(); await list.enter(); assert.equal(list.snapshot().items[0].eligible, true);
  await assert.rejects(h.service.readParentAssignment(token, { assignmentId: 'handoff-one' }), /locked/);
  token = await h.unlock(); await h.controller.open('handoff-one');
  assert.equal(h.controller.snapshot().detail.writeRevision, 2);
  await h.service.saveParentCorrections(token, { assignmentId: 'handoff-one', expectedWriteRevision: 2,
    corrections: [{ fieldPath: '/vocabulary/0/term', text: 'un meneur', correctionExplanation: 'Parent correction for this test.' }] });
  h.lock(); await list.enter(); assert.equal(list.snapshot().items[0].reviewRequired, true);
  token = await h.unlock(); await h.service.setPracticePolicy(token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  const before = h.snapshot(); h.lock(); await list.enter();
  assert.equal(list.snapshot().items[0].eligible, true); assert.equal(list.snapshot().items[0].reviewRequired, false);
  assert.deepEqual(h.snapshot(), before);
  assert.equal(h.snapshot().assignments[0].approval, null);
  assert.equal(h.snapshot().assignments[0].contentRevision, 2);
});
