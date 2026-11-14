const test = require('node:test');
const assert = require('node:assert/strict');
const { createHouseholdService } = require('../src/services/householdService');
const { parentInteraction, recordParentActivity } = require('../src/services/parent/parentActivity');
const { createDevelopmentSample } = require('../src/content/developmentSample');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const clone = value => JSON.parse(JSON.stringify(value));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function harness() {
  let state = null, time = 1000, available = true, readHook = null;
  const store = { read: async () => readHook ? readHook() : clone(state),
    update: async mutate => { const next = mutate(clone(state)); state = clone(next); return clone(state); } };
  const credential = { create: async () => ({ test: true }), valid: value => value?.test === true, verify: async () => true,
    assertAvailable() { if (!available) throw Error('Credentials unavailable'); } };
  const service = createHouseholdService({ store, credential, now: () => time, development: true, sampleProvider: createDevelopmentSample });
  await service.setup('123456', '123456');
  const token = await service.unlock('123456');
  return { service, token, state: () => state, advance: ms => { time += ms; }, available: value => { available = value; }, hook: fn => { readHook = fn; } };
}

test('obsolete policy read resolves or rejects without disclosing data, locking or renewing replacement session', async () => {
  for (const fail of [false, true]) {
    const h = await harness(); const pending = deferred(); const oldState = clone(h.state());
    h.hook(() => pending.promise);
    const read = assert.rejects(h.service.getParentPolicy(h.token), { code: 'parent_locked' });
    h.service.lock(); const newer = await h.service.unlock('123456');
    h.advance(299999); h.hook(null);
    if (fail) pending.reject(Error('Storage failure')); else pending.resolve(oldState);
    await read;
    assert.equal((await h.service.getParentPolicy(newer)).practiceMode, 'require_parent_approval');
    h.advance(1);
    await assert.rejects(h.service.getParentPolicy(newer), { code: 'parent_locked' });
  }
});

test('current policy reads recheck expiry and credential availability and permanently lock that session', async () => {
  for (const invalidate of [h => h.advance(300000), h => h.available(false)]) {
    const h = await harness(); const pending = deferred(); const state = clone(h.state());
    h.hook(() => pending.promise);
    const read = assert.rejects(h.service.getParentPolicy(h.token), { code: 'parent_locked' });
    invalidate(h); pending.resolve(state); await read;
    h.hook(null); h.available(true);
    await assert.rejects(h.service.getParentPolicy(h.token), { code: 'parent_locked' });
  }
});

test('new submitted and development documents start at one, mutate once and reject stale writes', async () => {
  const h = await harness();
  await h.service.submitAssignment({ ...clone(fixture), id: 'new-lesson' });
  const sampleId = await h.service.loadDevelopmentSample(h.token);
  for (const id of ['new-lesson', sampleId]) {
    assert.equal(h.state().assignments.find(d => d.assignment.id === id).writeRevision, 1);
    const request = { assignmentId: id, expectedWriteRevision: 1, fieldPaths: ['/vocabulary/0/term'], reviewed: true };
    const changed = await h.service.setFieldReview(h.token, request);
    assert.equal(changed.writeRevision, 2); assert.equal(changed.contentRevision, 1);
    await assert.rejects(h.service.setFieldReview(h.token, { ...request, reviewed: false }), { code: 'stale_document' });
  }
  const before = clone(h.state()); await h.service.loadDevelopmentSample(h.token);
  assert.deepEqual(h.state(), before);
});

test('genuine legacy sample stays revision zero on reads/reload and first mutation advances to one', async () => {
  const h = await harness(); const assignment = createDevelopmentSample();
  // Deliberately construct a legacy record, rather than creating one through the new-document API.
  h.state().assignments.push({ storageVersion: 1, contentRevision: 1, purpose: 'development_sample', assignment, approval: null });
  const before = clone(h.state());
  assert.equal((await h.service.readParentAssignment(h.token, { assignmentId: assignment.id })).writeRevision, 0);
  await h.service.loadDevelopmentSample(h.token); assert.deepEqual(h.state(), before);
  const changed = await h.service.setFieldReview(h.token, { assignmentId: assignment.id, expectedWriteRevision: 0, fieldPaths: ['/vocabulary/0/term'], reviewed: true });
  assert.equal(changed.writeRevision, 1); assert.equal(changed.contentRevision, 1);
});

test('explicit accessibility interaction renews only on activation, passes input and tolerates duplicate notifications', async () => {
  const h = await harness(); let current = h.token, locks = 0, calls = 0;
  const activity = () => recordParentActivity(h.token, { isCurrent: token => current === token, noteActivity: h.service.noteParentActivity,
    onLocked: () => { current = null; locks++; h.service.lock(); } });
  const action = parentInteraction(activity, value => { calls++; return value; });
  // Constructing callbacks/rendering/reading does not touch the timeout.
  h.advance(299999); await h.service.getParentPolicy(current); assert.equal(calls, 0);
  assert.equal(action('correction'), 'correction'); action('checkbox');
  h.advance(299999); assert.equal((await h.service.getParentPolicy(current)).practiceMode, 'require_parent_approval');
  h.advance(1); assert.equal(action('expired'), undefined); assert.equal(calls, 2); assert.equal(locks, 1);
  assert.equal(activity(), false); assert.equal(locks, 1);
});

test('stale activity cannot renew, lock or invoke an action in a replacement session', async () => {
  const h = await harness(); let current = h.token, locks = 0, actions = 0;
  const staleAction = parentInteraction(() => recordParentActivity(h.token, {
    isCurrent: token => token === current, noteActivity: h.service.noteParentActivity, onLocked: () => { locks++; h.service.lock(); },
  }), () => { actions++; });
  h.service.lock(); current = await h.service.unlock('123456'); h.advance(299999);
  staleAction(); assert.equal(actions, 0); assert.equal(locks, 0);
  await h.service.getParentPolicy(current); h.advance(1);
  await assert.rejects(h.service.getParentPolicy(current), { code: 'parent_locked' });
});
