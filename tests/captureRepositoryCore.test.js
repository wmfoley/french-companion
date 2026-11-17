const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core/capture/captureRepositoryCore');
const metadata = { method: 'camera', width: 1000, height: 1400, bytes: 100, mime: 'image/jpeg', sha256: 'a'.repeat(64) };
function fixture() {
  let serial = 0; let clock = 100;
  const core = C.createRepositoryCore({ newId: () => `id-${++serial}`, now: () => clock });
  let m = core.createCapture(C.emptyManifest(), 1);
  m = core.addPage(m, m.revision, m.captures[0].id, metadata);
  return { core, m, tick: value => { clock = value; } };
}
const capture = m => m.captures[0].id;
const asset = m => m.assets[0].id;
function saved() { const f = fixture(); f.m = f.core.save(f.m, f.m.revision, capture(f.m)); return f; }
function bound() {
  const f = saved();
  for (const assignmentId of ['lesson-a', 'lesson-b']) f.m = f.core.bind(f.m, f.m.revision,
    { assignmentId, sourceId: 'source-one', contentRevision: 1, assetId: asset(f.m) });
  return f;
}
test('creation uses unique stable identities and does not mutate input metadata', () => {
  const { m } = fixture(); assert.equal(C.validateManifest(m).valid, true);
  assert.equal(new Set([capture(m), m.pages[0].id, asset(m)]).size, 3);
  assert.deepEqual(m.assets[0], { id: asset(m), pageId: m.pages[0].id, ...metadata, fileKey: asset(m) });
  assert.equal(Object.hasOwn(metadata, 'fileKey'), false);
});
test('duplicate and invalid injected identities fail safely', () => {
  for (const value of ['../secret', '', 'id-1']) {
    const { m } = fixture(); const core = C.createRepositoryCore({ newId: () => value, now: () => 100 });
    assert.throws(() => core.createCapture(m, m.revision));
  }
});
test('10-page warning and 20-page maximum are deterministic', () => {
  let { core, m } = fixture();
  for (let n = 2; n <= 20; n++) {
    m = core.addPage(m, m.revision, capture(m), metadata);
    assert.equal(C.pageWarning(m, capture(m)), n >= 10);
  }
  assert.throws(() => core.addPage(m, m.revision, capture(m), metadata));
});
test('reorder keeps page identities and rejects duplicates or foreign pages', () => {
  let { core, m } = fixture(); m = core.addPage(m, m.revision, capture(m), metadata);
  const order = m.captures[0].pageIds.slice().reverse(); const original = C.serialize(m);
  const next = core.reorder(m, m.revision, capture(m), order);
  assert.deepEqual(next.captures[0].pageIds, order); assert.deepEqual(next.pages, m.pages);
  assert.equal(C.serialize(m), original);
  assert.throws(() => core.reorder(m, m.revision, capture(m), [order[0], order[0]]));
});
test('retake preserves immutable old assets and historical assignment bindings', () => {
  const { core, m } = bound(); const before = C.serialize(m);
  const next = core.retake(m, m.revision, m.pages[0].id, { ...metadata, sha256: 'b'.repeat(64) });
  assert.deepEqual(next.bindings, m.bindings); assert.deepEqual(next.assets[0], m.assets[0]);
  assert.equal(next.pages[0].id, m.pages[0].id); assert.notEqual(next.pages[0].currentAssetId, asset(m));
  assert.equal(C.serialize(m), before);
});
test('stale revisions and invalid lifecycle transitions are rejected', () => {
  const { core, m } = saved(); assert.throws(() => core.save(m, m.revision, capture(m)));
  assert.throws(() => core.retake(m, m.revision - 1, m.pages[0].id, metadata), { code: 'stale_revision' });
  assert.throws(() => core.addPage(m, m.revision, capture(m), metadata));
  const e = C.emptyManifest(); const draft = core.createCapture(e, e.revision);
  assert.throws(() => core.save(draft, draft.revision, capture(draft)));
});
function expiry(m, time, extra = {}) { return C.draftExpiry(m, capture(m), {
  now: () => time, referencesComplete: true, protectedAssetIds: [], pendingCaptureIds: [], ...extra,
}); }
test('draft expiry uses exact 24-hour boundary and injected clock', () => {
  const { m } = fixture(); assert.equal(expiry(m, 100 + C.DRAFT_TTL_MS - 1).eligible, false);
  assert.equal(expiry(m, 100 + C.DRAFT_TTL_MS).eligible, true);
  assert.deepEqual(expiry(m, 100 + C.DRAFT_TTL_MS).assetIds, [asset(m)]);
});
test('saved, referenced, protected and pending assets cannot silently expire', () => {
  const { m } = fixture(); const later = 100 + C.DRAFT_TTL_MS;
  for (const extra of [{ referencesComplete: false }, { protectedAssetIds: [asset(m)] }, { pendingCaptureIds: [capture(m)] }]) assert.equal(expiry(m, later, extra).eligible, false);
  assert.equal(expiry(saved().m, later).eligible, false);
  const b = bound().m; b.captures[0].status = 'draft'; assert.equal(expiry(b, later).eligible, false);
  const { core } = fixture(); const pending = core.beginDeletion(m, m.revision, C.deletionImpact(m, asset(m), true), true);
  assert.equal(expiry(pending, later).eligible, false);
});
test('shared deletion requires complete impact and exact revision snapshot', () => {
  const { core, m } = bound(); assert.throws(() => C.deletionImpact(m, asset(m), false), { code: 'incomplete_references' });
  const impact = C.deletionImpact(m, asset(m), true); assert.deepEqual(impact.assignmentIds, ['lesson-a', 'lesson-b']);
  assert.equal(impact.bindingIds.length, 2);
  assert.throws(() => core.beginDeletion(m, m.revision, { ...impact, bindingIds: [] }, true));
  assert.throws(() => core.beginDeletion(m, m.revision, impact, false));
});
test('intent then tombstone preserves immutable assets, source links and external assignments', () => {
  const { core, m, tick } = bound();
  const assignment = Object.freeze({ contentRevision: 1, writeRevision: 2, approval: Object.freeze({ method: 'reviewed' }) });
  const before = JSON.stringify(assignment);
  const pending = core.beginDeletion(m, m.revision, C.deletionImpact(m, asset(m), true), true);
  assert.equal(pending.intents[0].phase, 'pending');
  assert.throws(() => core.completeDeletion(pending, pending.revision, pending.intents[0].id, false));
  tick(200); const done = core.completeDeletion(pending, pending.revision, pending.intents[0].id, true);
  assert.equal(done.availability[0].status, 'intentionally_deleted'); assert.equal(done.intents[0].completedAt, 200);
  assert.deepEqual(done.assets, m.assets); assert.deepEqual(done.bindings, m.bindings);
  assert.equal(JSON.stringify(assignment), before);
  assert.throws(() => core.observe(done, done.revision, asset(done), 'available', 'verified'));
});
test('missing and corruption are separate from deletion and approval', () => {
  const { core, m } = saved();
  const corrupt = core.observe(m, m.revision, asset(m), 'available', 'corrupt');
  assert.equal(corrupt.availability[0].status, 'available');
  const missing = core.observe(corrupt, corrupt.revision, asset(m), 'unexpectedly_missing', 'unknown');
  assert.equal(missing.availability[0].integrity, 'unknown'); assert.equal(missing.intents.length, 0);
  assert.throws(() => core.observe(m, m.revision, asset(m), 'intentionally_deleted', 'verified'));
});
test('serialization is deterministic, defensive and version checked', () => {
  const { m } = bound(); const text = C.serialize(m); assert.deepEqual(C.deserialize(text), m);
  const reversed = Object.fromEntries(Object.entries(m).reverse()); assert.equal(C.serialize(reversed), text);
  const next = C.deserialize(text); next.assets[0].width = 1; assert.equal(m.assets[0].width, 1000);
  assert.throws(() => C.deserialize('{')); assert.equal(C.validateManifest({ ...m, schemaVersion: 2 }).valid, false);
});
test('malformed records and forged references fail closed', () => {
  const { m } = bound();
  const changes = [x => { x.assets[0].fileKey = '../private'; }, x => { x.assets[0].sha256 = 'unknown'; },
    x => { x.pages[0].currentAssetId = 'absent'; }, x => { x.bindings[0].assetId = 'absent'; },
    x => { x.approval = {}; }, x => { x.availability[0].status = 'intentionally_deleted'; },
    x => { x.assets[0].width = Infinity; }, x => { x.captures[0].pageIds = null; }];
  for (const change of changes) { const x = structuredClone(m); change(x); assert.equal(C.validateManifest(x).valid, false); }
  for (const value of [null, [], {}, undefined]) assert.equal(C.validateManifest(value).valid, false);
});
test('capacity results reject unknown/invalid data and apply no fixed quota', () => {
  assert.deepEqual(C.validateCapacity({ availableBytes: 100, requiredBytes: 100, warning: false }), { sufficient: true, warning: false });
  assert.equal(C.validateCapacity({ availableBytes: 0, requiredBytes: 1, warning: true }).sufficient, false);
  for (const availableBytes of [null, undefined, -1, NaN, Infinity, 1.5]) assert.throws(() => C.validateCapacity({ availableBytes, requiredBytes: 1, warning: false }));
});
test('frozen caller state is unchanged on success and failure', () => {
  function freeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; }
  const { core, m } = saved(); freeze(m); const before = C.serialize(m);
  core.retake(m, m.revision, m.pages[0].id, metadata);
  assert.throws(() => core.retake(m, m.revision, m.pages[0].id, { ...metadata, bytes: 0 }));
  assert.equal(C.serialize(m), before);
});
test('corrupt or missing originals cannot acquire a new source binding', () => {
  const { core, m } = saved(); const corrupt = core.observe(m, m.revision, asset(m), 'available', 'corrupt');
  assert.throws(() => core.bind(corrupt, corrupt.revision, { assignmentId: 'lesson', sourceId: 'source', contentRevision: 1, assetId: asset(m) }));
});
test('invalid intents, clocks and capacity shape are rejected without leaking data', () => {
  const { core, m } = bound();
  const pending = core.beginDeletion(m, m.revision, C.deletionImpact(m, asset(m), true), true);
  for (const mutate of [x => { x.intents[0].bindingIds.pop(); }, x => { x.intents[0].phase = 'complete'; }, x => { x.intents[0].issuedAt = -1; }]) {
    const x = structuredClone(pending); mutate(x); assert.equal(C.validateManifest(x).valid, false);
  }
  assert.throws(() => C.createRepositoryCore({}));
  assert.throws(() => expiry(m, NaN));
  assert.throws(() => C.validateCapacity({ availableBytes: 1, requiredBytes: 0, warning: false, secret: 'not-allowed' }));
});
const evidence = (m, extra = {}) => ({ manifestRevision: m.revision, referenceEpoch: 1,
  referencesComplete: true, protectedAssetIds: [], pendingCaptureIds: [], ...extra });
function cleanupFixture() { const f = fixture(); f.tick(100 + C.DRAFT_TTL_MS); return f; }
test('cleanup intent rejects before expiry and accepts the exact boundary', () => {
  const { core, m, tick } = fixture(); tick(100 + C.DRAFT_TTL_MS - 1);
  assert.throws(() => core.beginDraftCleanup(m, m.revision, capture(m), evidence(m)));
  tick(100 + C.DRAFT_TTL_MS);
  const pending = core.beginDraftCleanup(m, m.revision, capture(m), evidence(m));
  assert.equal(pending.cleanupIntents[0].phase, 'pending');
  assert.deepEqual(pending.assets, m.assets);
});
test('cleanup rejects saved, historical bindings, incomplete evidence and pending operations', () => {
  const f = saved(); f.tick(100 + C.DRAFT_TTL_MS);
  assert.throws(() => f.core.beginDraftCleanup(f.m, f.m.revision, capture(f.m), evidence(f.m)));
  const b = bound(); b.tick(100 + C.DRAFT_TTL_MS); b.m.captures[0].status = 'draft';
  assert.throws(() => b.core.beginDraftCleanup(b.m, b.m.revision, capture(b.m), evidence(b.m)));
  const { core, m } = cleanupFixture();
  for (const extra of [{ referencesComplete: false }, { protectedAssetIds: [asset(m)] }, { pendingCaptureIds: [capture(m)] }]) {
    assert.throws(() => core.beginDraftCleanup(m, m.revision, capture(m), evidence(m, extra)));
  }
  const deleting = core.beginDeletion(m, m.revision, C.deletionImpact(m, asset(m), true), true);
  assert.throws(() => core.beginDraftCleanup(deleting, deleting.revision, capture(deleting), evidence(deleting)));
});
test('cleanup freezes target state and rejects stale revisions/evidence', () => {
  const { core, m } = cleanupFixture();
  assert.throws(() => core.beginDraftCleanup(m, m.revision - 1, capture(m), evidence(m)), { code: 'stale_revision' });
  const p = core.beginDraftCleanup(m, m.revision, capture(m), evidence(m));
  assert.throws(() => core.save(p, p.revision, capture(p)));
  assert.throws(() => core.retake(p, p.revision, p.pages[0].id, metadata));
  assert.throws(() => core.reorder(p, p.revision, capture(p), p.captures[0].pageIds));
  assert.throws(() => core.observe(p, p.revision, asset(p), 'unexpectedly_missing', 'unknown'));
  assert.throws(() => core.completeDraftCleanup(p, m.revision, p.cleanupIntents[0].id, evidence(p), true));
  assert.throws(() => core.completeDraftCleanup(p, p.revision, p.cleanupIntents[0].id, evidence(m), true), { code: 'stale_evidence' });
});
test('interrupted cleanup round trips, rechecks protections and completes idempotently', () => {
  const { core, m } = cleanupFixture();
  const p = C.deserialize(C.serialize(core.beginDraftCleanup(m, m.revision, capture(m), evidence(m))));
  const intentId = p.cleanupIntents[0].id;
  assert.throws(() => core.completeDraftCleanup(p, p.revision, intentId, evidence(p), false));
  assert.throws(() => core.completeDraftCleanup(p, p.revision, intentId, evidence(p, { pendingCaptureIds: [capture(p)] }), true));
  assert.throws(() => core.completeDraftCleanup(p, p.revision, intentId, evidence(p, { referenceEpoch: 0 }), true));
  const done = core.completeDraftCleanup(p, p.revision, intentId, evidence(p), true);
  assert.equal(done.captures.length, 0); assert.equal(done.assets.length, 0);
  assert.deepEqual(done.cleanupIntents[0].snapshot.assets, m.assets);
  assert.equal(done.cleanupIntents[0].phase, 'complete');
  assert.equal(C.serialize(core.completeDraftCleanup(done, done.revision, intentId, evidence(done), true)), C.serialize(done));
  assert.equal(C.validateManifest(C.deserialize(C.serialize(done))).valid, true);
});
test('cleanup retains prior deletion tombstones and reserves historical identities', () => {
  const { core, m } = cleanupFixture();
  const deleting = core.beginDeletion(m, m.revision, C.deletionImpact(m, asset(m), true), true);
  const deleted = core.completeDeletion(deleting, deleting.revision, deleting.intents[0].id, true);
  const p = core.beginDraftCleanup(deleted, deleted.revision, capture(deleted), evidence(deleted));
  const done = core.completeDraftCleanup(p, p.revision, p.cleanupIntents[0].id, evidence(p), true);
  assert.deepEqual(done.cleanupIntents[0].snapshot.intents, deleted.intents);
  const duplicate = C.createRepositoryCore({ newId: () => asset(m), now: () => 100 });
  assert.throws(() => duplicate.createCapture(done, done.revision), { code: 'duplicate_identity' });
});
test('unrelated writes require fresh completion evidence without changing target snapshot', () => {
  const { core, m } = cleanupFixture();
  const p = core.beginDraftCleanup(m, m.revision, capture(m), evidence(m));
  const next = core.createCapture(p, p.revision);
  assert.throws(() => core.completeDraftCleanup(next, next.revision, p.cleanupIntents[0].id, evidence(p), true));
  const done = core.completeDraftCleanup(next, next.revision, p.cleanupIntents[0].id, evidence(next, { referenceEpoch: 2 }), true);
  assert.equal(done.captures.length, 1);
});
