const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { createHouseholdService } = require('../src/services/householdService');
const { applyMarkAllReviewed } = require('../src/core/assignments/assignmentReview');
const { enumerateEducationalFields } = require('../src/core/assignments/educationalFields');
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function document(id = 'household-lesson') { return { storageVersion: 1, contentRevision: 1, purpose: 'household_assignment', assignment: { ...clone(fixture), id }, approval: null }; }
async function harness({ development = false } = {}) {
  let state = null; let time = 1000; let reads = 0; let writes = 0; let hook = null; let available = true;
  // Deliberately returns live state: defensive service snapshots cannot depend on adapter copying.
  const store = { read: async () => { reads++; return hook ? hook(state) : state; },
    update: async mutate => { writes++; state = mutate(clone(state)); return clone(state); } };
  const credential = { valid: value => value?.testVerifier === true, create: async () => ({ testVerifier: true }), verify: async pin => pin === '123456',
    assertAvailable() { if (!available) throw Error('Native unavailable SECRET'); } };
  const service = createHouseholdService({ store, credential, now: () => time, development });
  await service.setup('123456', '123456');
  const token = await service.unlock('123456');
  state.assignments.push(document());
  return { service, token, state: () => state, reads: () => reads, writes: () => writes,
    advance: ms => { time += ms; }, hook: next => { hook = next; }, available: value => { available = value; } };
}

test('parents see pending and accepted assignments regardless of strict student eligibility', async () => {
  const h = await harness();
  const reviewed = applyMarkAllReviewed(document('reviewed-pending'), { expectedWriteRevision: 0, confirmReviewDeclaration: true }).document;
  const bulk = document('bulk-accepted'); bulk.assignment.reviewStatus = 'approved'; bulk.writeRevision = 4;
  bulk.approval = { method: 'bulk_risk_acknowledged', contentRevision: 1, acceptedAt: '2026-11-11T00:00:00Z', riskAcknowledgementVersion: 1 };
  const detailed = clone(reviewed); detailed.assignment.id = 'detailed-accepted'; detailed.assignment.reviewStatus = 'approved';
  detailed.approval = { method: 'reviewed', contentRevision: 1, acceptedAt: '2026-11-11T00:00:00Z', reviewedFieldPaths: enumerateEducationalFields(detailed.assignment).map(field => field.path) };
  h.state().assignments.push(reviewed, bulk, detailed);
  const before = JSON.stringify(h.state()); const writes = h.writes();
  assert.equal((await h.service.readPractice('household-lesson')).eligibility.eligible, false);
  const list = await h.service.listParentAssignments(h.token);
  assert.deepEqual(list.map(item => item.id), ['household-lesson', 'reviewed-pending', 'bulk-accepted', 'detailed-accepted']);
  assert.deepEqual(list[0].reviewProgress, { reviewed: 0, total: 20 });
  assert.equal(list[0].writeRevision, 0); assert.equal(list[0].approvalMethod, null); assert.equal(list[0].approvalValid, false);
  assert.deepEqual(list[1].reviewProgress, { reviewed: 20, total: 20 }); assert.equal(list[1].approvalMethod, null);
  assert.equal(list[1].reviewStatus, 'pending_review'); assert.equal(list[2].approvalMethod, 'bulk_risk_acknowledged');
  assert.equal(list[2].writeRevision, 4); assert.equal(list[2].approvalValid, true);
  assert.equal(list[3].approvalMethod, 'reviewed'); assert.equal(list[3].approvalValid, true);
  assert.ok(list.every(item => !('assignment' in item) && !('fields' in item) && !('approval' in item)));
  assert.ok(!JSON.stringify(list).includes('une personne qui dirige'));
  assert.equal(JSON.stringify(h.state()), before); assert.equal(h.writes(), writes);
});

test('detail returns independent sources, fields, review and effective revision without migrating legacy data', async () => {
  const h = await harness(); const before = JSON.stringify(h.state()); const writes = h.writes();
  const detail = await h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' });
  assert.deepEqual(detail.document, h.state().assignments[0]); assert.notEqual(detail.document, h.state().assignments[0]);
  assert.equal(detail.writeRevision, 0); assert.equal(Object.hasOwn(detail.document, 'writeRevision'), false);
  assert.equal(detail.review.ready, false); assert.equal(detail.fields.length, 20); assert.equal(detail.approvalValidation.valid, false);
  assert.equal(detail.document.assignment.sources[0].fidelity, 'reported_teacher_content');
  detail.document.assignment.sources[0].originalText = 'tampered'; detail.document.assignment.vocabulary[0].term.text = 'tampered';
  detail.fields[0].provenance.sourceIds.push('tampered'); detail.review.gaps.push({ code: 'tampered' });
  const list = await h.service.listParentAssignments(h.token); list[0].reviewProgress.total = 999;
  const fresh = await h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' });
  assert.equal(fresh.review.gaps.length, 0); assert.equal(fresh.fields[0].provenance.sourceIds.length, 1);
  assert.equal(JSON.stringify(h.state()), before); assert.equal(h.writes(), writes);
  assert.ok(!JSON.stringify(fresh).includes('testVerifier')); assert.ok(!('household' in fresh));
});

test('unauthorized and revoked direct calls reject before touching storage', async () => {
  const h = await harness(); const reads = h.reads();
  h.state().household.policy = { policyVersion: 1, revision: 2, practiceMode: 'allow_independent_practice', riskAcknowledgementVersion: 1 };
  for (const token of [undefined, null, {}, clone(h.token)]) {
    await assert.rejects(h.service.listParentAssignments(token), { code: 'parent_locked' });
    await assert.rejects(h.service.readParentAssignment(token, { assignmentId: 'household-lesson' }), { code: 'parent_locked' });
  }
  assert.equal(h.reads(), reads);
  h.service.lock(); await assert.rejects(h.service.listParentAssignments(h.token), { code: 'parent_locked' });
  await assert.rejects(h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' }), { code: 'parent_locked' });
  assert.equal(h.reads(), reads);
});

test('parent assignment reads neither refresh inactivity nor survive expiry', async () => {
  const h = await harness(); h.advance(299999);
  await h.service.listParentAssignments(h.token);
  await h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' });
  h.advance(1); const reads = h.reads();
  await assert.rejects(h.service.listParentAssignments(h.token), { code: 'parent_locked' });
  await assert.rejects(h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' }), { code: 'parent_locked' });
  assert.equal(h.reads(), reads);
});

for (const command of ['list', 'detail']) {
  test(`${command} rejects deferred results after lock, expiry or replacement without revoking a new session`, async () => {
    for (const cause of ['lock', 'expiry', 'replacement', 'lock-reunlock', 'native-unavailable']) {
      const h = await harness(); const pending = deferred(); h.hook(() => pending.promise);
      const reading = command === 'list' ? h.service.listParentAssignments(h.token) : h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' });
      const rejected = assert.rejects(reading, { code: 'parent_locked' });
      if (cause === 'lock' || cause === 'lock-reunlock') h.service.lock();
      if (cause === 'expiry') h.advance(300000);
      if (cause === 'native-unavailable') h.available(false);
      let current;
      if (cause === 'replacement' || cause === 'lock-reunlock') current = await h.service.unlock('123456');
      pending.resolve(h.state()); await rejected; h.hook(null);
      if (current) assert.equal((await h.service.listParentAssignments(current)).length, 1);
    }
  });
}

test('storage errors and availability loss are sanitized and fail closed without writes', async () => {
  const h = await harness(); const writes = h.writes();
  h.hook(() => { throw Error('PRIVATE SOURCE DATA'); });
  for (const operation of [() => h.service.listParentAssignments(h.token), () => h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' })]) {
    await assert.rejects(operation(), error => error.code === 'persistence_failed' && !error.message.includes('PRIVATE'));
  }
  h.hook(null); h.available(false);
  await assert.rejects(h.service.listParentAssignments(h.token), error => error.code === 'parent_locked' && !error.message.includes('SECRET'));
  assert.equal(h.writes(), writes);
});

test('late rejected reads after session replacement cannot expose errors or lock the new session', async () => {
  for (const command of ['list', 'detail']) {
    const h = await harness(); const pending = deferred(); h.hook(() => pending.promise);
    const reading = command === 'list' ? h.service.listParentAssignments(h.token) : h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' });
    const rejected = assert.rejects(reading, error => error.code === 'parent_locked' && !error.message.includes('PRIVATE'));
    h.service.lock(); const token = await h.service.unlock('123456');
    pending.reject(Error('PRIVATE SOURCE DATA')); await rejected; h.hook(null);
    assert.equal((await h.service.listParentAssignments(token)).length, 1);
  }
});

test('malformed, unsupported and ambiguous documents reject without returning partial lists or resetting data', async () => {
  for (const mutate of [d => { d.storageVersion = 2; }, d => { d.contentRevision = 0; }, d => { d.writeRevision = null; },
    d => { d.assignment.vocabulary[0].term.text = ' '; }, d => { d.purpose = 'unknown'; }]) {
    const h = await harness(); const bad = document('bad-lesson'); mutate(bad); h.state().assignments.push(bad);
    const before = JSON.stringify(h.state()); const writes = h.writes();
    await assert.rejects(h.service.listParentAssignments(h.token), { code: 'unsupported_document' });
    await assert.rejects(h.service.readParentAssignment(h.token, { assignmentId: 'bad-lesson' }), { code: 'unsupported_document' });
    assert.equal(JSON.stringify(h.state()), before); assert.equal(h.writes(), writes);
  }
  const h = await harness(); h.state().assignments.push(document());
  await assert.rejects(h.service.listParentAssignments(h.token), { code: 'unsupported_document' });
  await assert.rejects(h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' }), { code: 'unsupported_document' });
});

test('invalid acceptance evidence is reported honestly without hiding structurally valid parent content', async () => {
  const h = await harness(); const d = h.state().assignments[0]; d.assignment.reviewStatus = 'approved';
  d.approval = { method: 'reviewed', contentRevision: 1, acceptedAt: '2026-11-11T00:00:00Z', reviewedFieldPaths: ['/vocabulary/0/term'] };
  const list = await h.service.listParentAssignments(h.token);
  assert.equal(list[0].reviewStatus, 'approved'); assert.equal(list[0].approvalMethod, null); assert.equal(list[0].approvalValid, false);
  assert.equal((await h.service.readParentAssignment(h.token, { assignmentId: 'household-lesson' })).approvalValidation.valid, false);
  assert.equal((await h.service.readPractice('household-lesson')).eligibility.eligible, false);
});

test('development copy is parent-readable only in development and retains purpose/practice restrictions', async () => {
  for (const development of [true, false]) {
    const h = await harness({ development }); const sample = document('fc004n-development-sample'); sample.purpose = 'development_sample';
    h.state().assignments.push(sample); const before = JSON.stringify(sample);
    const list = await h.service.listParentAssignments(h.token);
    assert.equal(list.some(item => item.id === sample.assignment.id), development);
    if (development) {
      const detail = await h.service.readParentAssignment(h.token, { assignmentId: sample.assignment.id });
      assert.equal(detail.document.purpose, 'development_sample'); assert.equal(detail.document.assignment.reviewStatus, 'pending_review');
    } else await assert.rejects(h.service.readParentAssignment(h.token, { assignmentId: sample.assignment.id }), { code: 'assignment_not_found' });
    assert.equal((await h.service.readPractice(sample.assignment.id)).eligibility.eligible, false);
    assert.equal(JSON.stringify(sample), before);
  }
});

test('empty lists, bad identifiers, absent assignments and service recreation do not bypass parent capability', async () => {
  const h = await harness(); h.state().assignments = [];
  assert.deepEqual(await h.service.listParentAssignments(h.token), []);
  await assert.rejects(h.service.readParentAssignment(h.token, { assignmentId: 'missing' }), { code: 'assignment_not_found' });
  for (const request of [undefined, null, {}, 'household-lesson', { assignmentId: '../escape' }, { assignmentId: 'missing', capability: h.token }]) {
    await assert.rejects(h.service.readParentAssignment(h.token, request), { code: 'invalid_field' });
  }
  const other = createHouseholdService({ supported: false });
  await assert.rejects(other.listParentAssignments(h.token), { code: 'parent_locked' });
});
