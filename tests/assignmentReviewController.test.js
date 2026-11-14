const test = require('node:test');
const assert = require('node:assert/strict');
const { createAssignmentReviewController } = require('../src/services/parent/assignmentReviewController');
const { createHouseholdService } = require('../src/services/householdService');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function harness() {
  let state = null; let token; let locked = 0;
  const store = { read: async () => clone(state), update: async mutate => { const next = mutate(clone(state)); state = clone(next); return clone(next); } };
  const credential = { create: async () => ({ test: true }), valid: value => value?.test === true, verify: async () => true };
  const service = createHouseholdService({ store, credential });
  await service.setup('123456', '123456'); token = await service.unlock('123456');
  await service.submitAssignment({ ...clone(fixture), id: 'parent-lesson' });
  const controller = createAssignmentReviewController({ service, getCapability: () => token, onLocked: () => { token = null; locked++; } });
  return { controller, service, state: () => state, setToken: value => { token = value; }, locked: () => locked };
}

test('review saves and authorized rereads never blank detail; failed changes remain unchecked', async () => {
  const h = await harness(); const c = h.controller; await c.open('parent-lesson');
  const entered = deferred(); const release = deferred(); const read = h.service.readParentAssignment;
  h.service.readParentAssignment = async (...args) => { entered.resolve(); await release.promise; return read(...args); };
  const snapshots = []; const unsubscribe = c.subscribe(() => snapshots.push(c.snapshot()));
  const pending = c.reviewField('/vocabulary/0/term', true); await entered.promise;
  assert.ok(c.snapshot().detail); assert.equal(c.snapshot().detail.writeRevision, 1);
  await c.reviewField('/vocabulary/0/term', true); // duplicate blocked
  release.resolve(); await pending; h.service.readParentAssignment = read; unsubscribe();
  assert.ok(snapshots.every(s => s.detail !== null && s.view === 'detail'));
  assert.equal(c.snapshot().detail.writeRevision, 2);
  await c.reviewField('/vocabulary/0/term', false); assert.equal(c.snapshot().detail.review.reviewedFieldPaths.length, 0);
  h.service.setFieldReview = async () => { const error = Error('test'); error.code = 'persistence_failed'; throw error; };
  await c.reviewField('/vocabulary/0/term', true);
  assert.equal(c.snapshot().detail.review.reviewedFieldPaths.length, 0); assert.equal(c.snapshot().detail.writeRevision, 3);
});

test('inline editor switching protects dirty text and leaves assignment detail visible', async () => {
  const h = await harness(); const c = h.controller; await c.open('parent-lesson');
  const detail = c.snapshot().detail;
  c.editField('/vocabulary/0/term'); c.changeEdit('text', 'Unsaved'); c.editField('/vocabulary/0/definitionFr');
  assert.equal(c.snapshot().detail, detail); assert.equal(c.snapshot().view, 'detail');
  assert.equal(c.snapshot().edit.path, '/vocabulary/0/term'); assert.deepEqual(c.snapshot().discard, { editPath: '/vocabulary/0/definitionFr' });
  c.keepEditing(); assert.equal(c.snapshot().edit.text, 'Unsaved'); c.editField('/vocabulary/0/definitionFr'); c.discardEdits();
  assert.equal(c.snapshot().edit.path, '/vocabulary/0/definitionFr'); assert.equal(c.snapshot().view, 'detail');
  c.navigate('detail'); assert.equal(c.snapshot().edit, null);
});

test('inline correction preserves unrelated reviews and keeps detail mounted through authorized refresh', async () => {
  const h = await harness(); const c = h.controller; await c.open('parent-lesson');
  c.confirm('all'); c.changeConfirmation('checked', true); await c.submitConfirmation();
  const before = c.snapshot().detail.fields;
  c.editField('/vocabulary/0/term'); c.changeEdit('text', 'un meneur'); c.changeEdit('explanation', 'Parent correction.');
  const snapshots = []; const unsubscribe = c.subscribe(() => snapshots.push(c.snapshot()));
  await c.saveCorrection(); unsubscribe();
  assert.ok(snapshots.every(s => s.detail && s.view === 'detail'));
  assert.equal(c.snapshot().detail.review.reviewedFieldPaths.length, 19);
  assert.equal(c.snapshot().detail.document.approval, null); assert.equal(c.snapshot().edit, null);
  for (const field of before) if (field.path !== '/vocabulary/0/term') assert.deepEqual(c.snapshot().detail.fields.find(f => f.path === field.path), field);
});
test('list/detail navigation, persisted review and approval confirmations are separate', async () => {
  const { controller: c } = await harness();
  await c.list(); assert.equal(c.snapshot().list.length, 1); assert.equal(c.snapshot().list[0].reviewStatus, 'pending_review');
  await c.open('parent-lesson'); c.confirm('detailed'); assert.equal(c.snapshot().confirmation, null);
  c.confirm('all'); assert.equal(c.snapshot().confirmation.checked, false);
  await c.submitConfirmation(); assert.equal(c.snapshot().detail.writeRevision, 1);
  c.changeConfirmation('checked', true); await c.submitConfirmation();
  assert.equal(c.snapshot().detail.review.reviewedFieldPaths.length, 20); assert.equal(c.snapshot().detail.approvalValidation.valid, false);
  c.confirm('detailed'); c.changeConfirmation('checked', true); await c.submitConfirmation();
  assert.equal(c.snapshot().detail.approvalValidation.valid, false);
  c.changeConfirmation('noGaps', true); await c.submitConfirmation();
  assert.equal(c.snapshot().detail.document.approval.method, 'reviewed');
  c.confirm('risk'); assert.equal(c.snapshot().confirmation.checked, false); c.cancelConfirmation(); c.confirm('risk');
  assert.equal(c.snapshot().confirmation.checked, false);
  c.changeConfirmation('checked', true); await c.submitConfirmation();
  assert.equal(c.snapshot().detail.document.approval.method, 'bulk_risk_acknowledged');
  await c.navigate('list'); assert.equal(c.snapshot().list[0].approvalMethod, 'bulk_risk_acknowledged');
});
test('edit cancellation warns, keep retains buffers, discard clears them, save rereads revisions', async () => {
  const { controller: c } = await harness(); await c.open('parent-lesson');
  const text = c.snapshot().detail.fields[0].text; c.editField('/vocabulary/0/term');
  c.changeEdit('text', 'un dirigeant corrigé'); c.navigate('list');
  assert.equal(c.snapshot().view, 'detail'); assert.ok(c.snapshot().edit); assert.equal(c.snapshot().discard, 'list');
  c.keepEditing(); assert.equal(c.snapshot().edit.text, 'un dirigeant corrigé');
  c.navigate('detail'); await c.discardEdits(); assert.equal(c.snapshot().edit, null); assert.equal(c.snapshot().detail.fields[0].text, text);
  c.editField('/vocabulary/0/term'); c.changeEdit('text', 'un dirigeant corrigé');
  await c.saveCorrection(); assert.ok(c.snapshot().edit); // explanation required
  c.changeEdit('explanation', 'Parent correction.'); await c.saveCorrection();
  assert.equal(c.snapshot().view, 'detail'); assert.equal(c.snapshot().edit, null); assert.equal(c.snapshot().detail.writeRevision, 2);
  assert.equal(c.snapshot().detail.document.contentRevision, 2); assert.equal(c.snapshot().detail.review.reviewedFieldPaths.length, 0);
});
test('security lock bypasses unsaved prompts and immediately clears protected content', async () => {
  const { controller: c } = await harness(); await c.open('parent-lesson');
  c.editField('/vocabulary/0/term'); c.changeEdit('text', 'Private unsaved buffer'); c.navigate('home'); c.lock();
  assert.deepEqual(c.snapshot(), { view: 'home', list: [], detail: null, edit: null, confirmation: null, discard: null, busy: false, message: '' });
  assert.equal(JSON.stringify(c.snapshot()).includes('Private'), false);
});
test('stale edit reloads persisted state, discards old buffers and requires reconsideration', async () => {
  const h = await harness(); const c = h.controller; await c.open('parent-lesson');
  c.editField('/vocabulary/0/term'); c.changeEdit('text', 'Old change'); c.changeEdit('explanation', 'Old reason');
  h.state().assignments[0].writeRevision = 3;
  await c.saveCorrection(); assert.equal(c.snapshot().view, 'detail'); assert.equal(c.snapshot().edit, null);
  assert.equal(c.snapshot().detail.writeRevision, 3); assert.match(c.snapshot().message, /reconsider/);
});
test('rapid reads/submissions run once and old completions cannot replace re-entered state', async () => {
  const h = await harness(); const c = h.controller; const pending = deferred();
  const original = h.service.listParentAssignments; let calls = 0;
  h.service.listParentAssignments = async (...args) => { calls++; await pending.promise; return original(...args); };
  const old = c.list(); await c.list(); assert.equal(calls, 1);
  c.lock(); h.service.listParentAssignments = original;
  await c.open('parent-lesson'); pending.resolve(); await old;
  assert.equal(c.snapshot().view, 'detail'); assert.equal(c.snapshot().busy, false);
  const save = deferred(); const originalSave = h.service.approveWithoutDetailedReview; calls = 0;
  h.service.approveWithoutDetailedReview = async (...args) => { calls++; await save.promise; return originalSave(...args); };
  c.confirm('risk'); c.changeConfirmation('checked', true);
  const first = c.submitConfirmation(); await c.submitConfirmation(); assert.equal(calls, 1);
  save.resolve(); await first; assert.equal(c.snapshot().detail.writeRevision, 2);
});
test('authorization rejection clears data; replaced capability suppresses stale results without locking new session', async () => {
  const h = await harness(); const c = h.controller; await c.open('parent-lesson');
  h.service.lock(); await c.reviewField('/vocabulary/0/term');
  assert.equal(h.locked(), 1); assert.equal(c.snapshot().detail, null);
  const token = await h.service.unlock('123456'); h.setToken(token);
  const pending = deferred(); const original = h.service.readParentAssignment;
  h.service.readParentAssignment = async (...args) => { await pending.promise; return original(...args); };
  const old = c.open('parent-lesson'); c.lock();
  const newer = await h.service.unlock('123456'); h.setToken(newer); h.service.readParentAssignment = original;
  await c.open('parent-lesson'); pending.resolve(); await old;
  assert.equal(h.locked(), 1); assert.equal(c.snapshot().detail.document.assignment.id, 'parent-lesson');
  await h.service.listParentAssignments(newer);
});
test('malformed/read failures have safe states and no fabricated assignments', async () => {
  const h = await harness(); const c = h.controller;
  h.state().assignments[0].writeRevision = null; await c.list();
  assert.equal(c.snapshot().list.length, 0); assert.match(c.snapshot().message, /invalid or unsupported/); assert.equal(c.snapshot().busy, false);
  h.state().assignments = []; await c.list(); assert.equal(c.snapshot().list.length, 0); assert.equal(c.snapshot().message, '');
});

test('late committed approval cannot publish after lock or overwrite a new authorized view', async () => {
  const h = await harness(); const c = h.controller; await c.open('parent-lesson');
  const entered = deferred(); const release = deferred(); const approve = h.service.approveWithoutDetailedReview;
  h.service.approveWithoutDetailedReview = async (...args) => { const result = await approve(...args); entered.resolve(); await release.promise; return result; };
  c.confirm('risk'); c.changeConfirmation('checked', true); const pending = c.submitConfirmation();
  await entered.promise; c.lock(); h.service.lock(); h.setToken(null);
  assert.equal(c.snapshot().detail, null); assert.equal(c.snapshot().confirmation, null);
  const token = await h.service.unlock('123456'); h.setToken(token); await c.open('parent-lesson');
  assert.equal(c.snapshot().detail.approvalValidation.valid, true);
  const current = c.snapshot(); release.resolve(); await pending;
  assert.equal(c.snapshot(), current); await h.service.listParentAssignments(token);
});
