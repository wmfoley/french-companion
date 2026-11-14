const test = require('node:test');
const assert = require('node:assert/strict');
const { createHouseholdService } = require('../src/services/householdService');
const { createDevelopmentSample } = require('../src/content/developmentSample');
const { enumerateEducationalFields } = require('../src/core/assignments/educationalFields');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const id = 'household-lesson';
const review = revision => ({ assignmentId: id, expectedWriteRevision: revision, fieldPaths: ['/vocabulary/0/term'], reviewed: true });
const correction = revision => ({ assignmentId: id, expectedWriteRevision: revision,
  corrections: [{ fieldPath: '/vocabulary/0/term', text: 'un dirigeant corrigé', correctionExplanation: 'Parent correction for testing.' }] });
async function harness() {
  let state = null; let time = 1000; let before; let after; let response; let fail = false;
  let queue = Promise.resolve();
  const store = { read: async () => clone(state), update(mutate) {
    const entry = before; const completion = after; const delivery = response;
    const result = queue.then(async () => {
      if (entry) await entry();
      const next = mutate(clone(state));
      // Represents the adapter write having been validly issued, before commit completion.
      if (completion) await completion();
      if (fail) throw Error('PRIVATE storage failure');
      state = clone(next); return clone(state);
    });
    queue = result.catch(() => {}); return result.then(async value => { if (delivery) await delivery(); return value; });
  } };
  const credential = { valid: value => value?.test === true, create: async () => ({ test: true }), verify: async pin => pin === '123456' };
  const makeService = (development = true) => createHouseholdService({ store, credential, now: () => time, development, sampleProvider: createDevelopmentSample });
  const service = makeService(); await service.setup('123456', '123456'); const token = await service.unlock('123456');
  state.assignments.push({ storageVersion: 1, contentRevision: 1, purpose: 'household_assignment', assignment: { ...clone(fixture), id }, approval: null });
  return { service, token, makeService, state: () => state, before: f => { before = f; }, after: f => { after = f; },
    response: f => { response = f; }, fail: value => { fail = value; }, advance: ms => { time += ms; } };
}

const detailedApproval = revision => ({ assignmentId: id, expectedWriteRevision: revision, confirmAcceptance: true, confirmNoKnownGaps: true });
const riskApproval = revision => ({ assignmentId: id, expectedWriteRevision: revision, confirmAcceptance: true, acknowledgeRisk: true });

test('selective correction clears either approval method and requires fresh revision-bound detailed acceptance', async () => {
  for (const risk of [false, true]) {
    const h = await harness(); await h.service.markAllReviewed(h.token, { assignmentId: id, expectedWriteRevision: 0, confirmReviewDeclaration: true });
    const approved = risk ? await h.service.approveWithoutDetailedReview(h.token, riskApproval(1)) : await h.service.approveReviewedAssignment(h.token, detailedApproval(1));
    const before = JSON.stringify(h.state().assignments);
    h.fail(true); await assert.rejects(h.service.saveParentCorrections(h.token, correction(2)), { code: 'persistence_failed' });
    assert.equal(JSON.stringify(h.state().assignments), before); h.fail(false);
    await h.service.saveParentCorrections(h.token, correction(2));
    await assert.rejects(h.service.saveParentCorrections(h.token, correction(2)), { code: 'stale_document' });
    const recreated = h.makeService(); const token = await recreated.unlock('123456');
    let detail = await recreated.readParentAssignment(token, { assignmentId: id });
    assert.equal(detail.review.reviewedFieldPaths.length, 19); assert.equal(detail.writeRevision, 3); assert.equal(detail.document.contentRevision, 2);
    assert.equal(detail.document.approval, null); assert.equal((await recreated.readPractice(id)).eligibility.eligible, false);
    await assert.rejects(recreated.approveReviewedAssignment(token, detailedApproval(3)), { code: 'review_incomplete' });
    await recreated.setFieldReview(token, review(3));
    assert.equal((await recreated.readPractice(id)).eligibility.eligible, false);
    detail = await recreated.readParentAssignment(token, { assignmentId: id });
    const { validateApprovalEvidence } = require('../src/core/assignments/assignmentDocument');
    assert.equal(validateApprovalEvidence({ ...detail.document, assignment: { ...detail.document.assignment, reviewStatus: 'approved' }, approval: approved.approval }).valid, false);
    const fresh = await recreated.approveReviewedAssignment(token, detailedApproval(4));
    assert.equal(fresh.approval.contentRevision, 2); assert.equal(fresh.approval.reviewedFieldPaths.length, 20);
    assert.equal(fresh.writeRevision, 5); assert.equal(fresh.contentRevision, 2);
    assert.equal((await recreated.readPractice(id)).eligibility.eligible, true);
  }
});

test('protected check/uncheck persists exact revisions and distinguishes detailed from risk acceptance', async () => {
  for (const risk of [false, true]) {
    const h = await harness(); await h.service.markAllReviewed(h.token, { assignmentId: id, expectedWriteRevision: 0, confirmReviewDeclaration: true });
    if (risk) await h.service.approveWithoutDetailedReview(h.token, riskApproval(1));
    else await h.service.approveReviewedAssignment(h.token, detailedApproval(1));
    const next = await h.service.setFieldReview(h.token, { ...review(2), reviewed: false });
    assert.equal(next.writeRevision, 3); assert.equal(next.contentRevision, 1);
    assert.equal((await h.service.readPractice(id)).eligibility.eligible, risk);
    const token = await h.makeService().unlock('123456');
    assert.ok(token); assert.equal(h.state().assignments[0].assignment.vocabulary[0].term.provenance.reviewStatus, 'pending_review');
    await assert.rejects(h.service.setFieldReview({}, { ...review(3), reviewed: false }), { code: 'parent_locked' });
  }
});

for (const method of ['approveReviewedAssignment', 'approveWithoutDetailedReview']) {
  const detailed = method === 'approveReviewedAssignment';
  const approval = detailed ? detailedApproval : riskApproval;
  async function ready() {
    const h = await harness();
    if (detailed) await h.service.markAllReviewed(h.token, { assignmentId: id, expectedWriteRevision: 0, confirmReviewDeclaration: true });
    return { h, revision: detailed ? 1 : 0 };
  }
  test(`${method} persists method-aware evidence, preserves sources and authorizes strict practice`, async () => {
    const { h, revision } = await ready(); const original = clone(h.state().assignments[0]);
    assert.equal((await h.service.readPractice(id)).eligibility.eligible, false);
    const result = await h.service[method](h.token, approval(revision));
    assert.equal(result.writeRevision, revision + 1); assert.equal(result.contentRevision, 1);
    assert.equal(result.assignment.reviewStatus, 'approved');
    assert.equal(result.approval.method, detailed ? 'reviewed' : 'bulk_risk_acknowledged');
    assert.equal(result.approval.acceptedAt, '1970-01-01T00:00:01.000Z');
    assert.deepEqual(result.assignment, { ...original.assignment, reviewStatus: 'approved' });
    assert.equal(result.approval.contentRevision, result.contentRevision);
    if (detailed) assert.equal(result.approval.reviewedFieldPaths.length, 20);
    else { assert.equal(result.approval.riskAcknowledgementVersion, 1); assert.equal('reviewedFieldPaths' in result.approval, false); }
    assert.equal((await h.service.readPractice(id)).eligibility.eligible, true);
    result.assignment.sources[0].originalText = 'tampered';
    const recreated = h.makeService(); const token = await recreated.unlock('123456');
    const fresh = await recreated.readParentAssignment(token, { assignmentId: id });
    assert.equal(fresh.writeRevision, revision + 1); assert.deepEqual(fresh.document.assignment.sources, original.assignment.sources);
    await recreated.saveParentCorrections(token, correction(revision + 1));
    assert.equal((await recreated.readPractice(id)).eligibility.eligible, false);
  });
  test(`${method} rejects missing confirmations, stale revisions, overflow and failed storage without mutation`, async () => {
    const { h, revision } = await ready(); const before = JSON.stringify(h.state());
    for (const key of detailed ? ['confirmAcceptance', 'confirmNoKnownGaps'] : ['confirmAcceptance', 'acknowledgeRisk']) {
      for (const value of [undefined, false, 'true', 1]) {
        await assert.rejects(h.service[method](h.token, { ...approval(revision), [key]: value }), { code: 'confirmation_required' });
        assert.equal(JSON.stringify(h.state()), before);
      }
    }
    await assert.rejects(h.service[method](h.token, approval(revision + 1)), { code: 'stale_document' });
    await assert.rejects(h.service[method](h.token, { ...approval(revision), approval: { method: 'forged' } }), { code: 'invalid_field' });
    h.fail(true); await assert.rejects(h.service[method](h.token, approval(revision)), { code: 'persistence_failed' });
    assert.equal(JSON.stringify(h.state()), before); h.fail(false);
    h.state().assignments[0].writeRevision = Number.MAX_SAFE_INTEGER;
    await assert.rejects(h.service[method](h.token, approval(Number.MAX_SAFE_INTEGER)), { code: 'revision_overflow' });
  });
  test(`${method} rejects forged/expired/revoked/replaced capabilities while queued`, async () => {
    for (const cause of ['forged', 'expired', 'revoked', 'replaced']) {
      const { h, revision } = await ready(); const before = JSON.stringify(h.state().assignments);
      if (cause === 'forged') { await assert.rejects(h.service[method]({}, approval(revision)), { code: 'parent_locked' }); continue; }
      const entered = deferred(); const release = deferred(); h.before(() => { entered.resolve(); return release.promise; });
      const pending = h.service[method](h.token, approval(revision)); const rejected = assert.rejects(pending, { code: 'parent_locked' });
      await entered.promise; h.before(null);
      if (cause === 'expired') h.advance(300000); else h.service.lock();
      const unlocking = cause === 'replaced' ? h.service.unlock('123456') : null;
      release.resolve(); await rejected; const current = unlocking && await unlocking;
      assert.equal(JSON.stringify(h.state().assignments), before);
      if (current) await h.service.listParentAssignments(current);
    }
  });
  test(`${method} completes an issued write after lock but suppresses protected response`, async () => {
    const { h, revision } = await ready(); const entered = deferred(); const release = deferred();
    h.after(() => { entered.resolve(); return release.promise; });
    const pending = h.service[method](h.token, approval(revision)); const rejected = assert.rejects(pending, { code: 'parent_locked' });
    await entered.promise; h.service.lock(); h.after(null); release.resolve(); await rejected;
    const token = await h.service.unlock('123456'); const fresh = await h.service.readParentAssignment(token, { assignmentId: id });
    assert.equal(fresh.writeRevision, revision + 1); assert.equal(fresh.approvalValidation.valid, true);
  });
  test(`${method} late response cannot revoke or renew a newer parent session`, async () => {
    const { h, revision } = await ready(); const entered = deferred(); const release = deferred();
    h.response(() => { entered.resolve(); return release.promise; });
    const pending = h.service[method](h.token, approval(revision)); const rejected = assert.rejects(pending, { code: 'parent_locked' });
    await entered.promise; h.response(null); h.service.lock(); const current = await h.service.unlock('123456');
    h.advance(299999); release.resolve(); await rejected;
    assert.equal((await h.service.readParentAssignment(current, { assignmentId: id })).writeRevision, revision + 1);
    h.advance(1); await assert.rejects(h.service.listParentAssignments(current), { code: 'parent_locked' });
  });
}

test('detailed acceptance requires full coverage and rejects known gaps without inventing absent content', async () => {
  const h = await harness();
  await assert.rejects(h.service.approveReviewedAssignment(h.token, detailedApproval(0)), { code: 'review_incomplete' });
  delete h.state().assignments[0].assignment.vocabulary[0].definitionFr;
  await h.service.markAllReviewed(h.token, { assignmentId: id, expectedWriteRevision: 0, confirmReviewDeclaration: true });
  const before = JSON.stringify(h.state().assignments);
  await assert.rejects(h.service.approveReviewedAssignment(h.token, detailedApproval(1)), { code: 'known_gaps' });
  assert.equal(JSON.stringify(h.state().assignments), before);
  await h.service.approveWithoutDetailedReview(h.token, riskApproval(1));
  assert.equal((await h.service.readPractice(id)).eligibility.eligible, true);
  assert.equal(h.state().assignments[0].assignment.vocabulary[0].definitionFr, undefined);
});

test('risk acceptance leaves independent policy unchanged and cannot bypass malformed content or production sample guards', async () => {
  const h = await harness(); await h.service.setPracticePolicy(h.token, { expectedRevision: 1, practiceMode: 'allow_independent_practice', acknowledgeRisk: true });
  const policy = clone(h.state().household.policy);
  assert.equal((await h.service.readPractice(id)).eligibility.eligible, true);
  await h.service.approveWithoutDetailedReview(h.token, riskApproval(0));
  await h.service.saveParentCorrections(h.token, correction(1));
  assert.equal((await h.service.readPractice(id)).eligibility.eligible, true); assert.deepEqual(h.state().household.policy, policy);
  h.state().assignments[0].assignment.vocabulary[0].term.text = ' ';
  const before = JSON.stringify(h.state().assignments);
  await assert.rejects(h.service.approveWithoutDetailedReview(h.token, riskApproval(2)), { code: 'unsupported_document' });
  assert.equal(JSON.stringify(h.state().assignments), before);
  const sampleId = await h.service.loadDevelopmentSample(h.token);
  await h.service.approveWithoutDetailedReview(h.token, { ...riskApproval(1), assignmentId: sampleId });
  const saved = clone(h.state().assignments.find(d => d.assignment.id === sampleId));
  await h.service.loadDevelopmentSample(h.token); assert.deepEqual(h.state().assignments.find(d => d.assignment.id === sampleId), saved);
  const production = h.makeService(false); const token = await production.unlock('123456');
  await assert.rejects(production.approveWithoutDetailedReview(token, { ...riskApproval(2), assignmentId: sampleId }), { code: 'assignment_not_found' });
});

test('authorized review and corrections persist revisions, exact sources and independent snapshots', async () => {
  const h = await harness(); const original = clone(h.state().assignments[0].assignment);
  let result = await h.service.setFieldReview(h.token, review(0));
  assert.equal(result.writeRevision, 1); assert.equal(result.contentRevision, 1); assert.equal(result.approval, null);
  result.assignment.vocabulary[0].term.text = 'tamper';
  result = await h.service.markAllReviewed(h.token, { assignmentId: id, expectedWriteRevision: 1, confirmReviewDeclaration: true });
  assert.equal(result.writeRevision, 2); assert.equal(result.contentRevision, 1);
  assert.ok(enumerateEducationalFields(result.assignment).every(f => f.provenance.reviewStatus === 'approved'));
  assert.equal((await h.service.readPractice(id)).eligibility.eligible, false);
  result = await h.service.saveParentCorrections(h.token, correction(2));
  assert.equal(result.writeRevision, 3); assert.equal(result.contentRevision, 2); assert.equal(result.approval, null);
  assert.equal(result.assignment.reviewStatus, 'pending_review');
  assert.equal(enumerateEducationalFields(result.assignment).filter(f => f.provenance.reviewStatus === 'approved').length, 19);
  assert.deepEqual(result.assignment.sources, original.sources);
  assert.deepEqual(result.assignment.vocabulary.map(v => v.id), original.vocabulary.map(v => v.id));
  assert.deepEqual(result.assignment.vocabulary[0].term.provenance.sourceIds, original.vocabulary[0].term.provenance.sourceIds);
  assert.equal(result.assignment.vocabulary[0].term.provenance.origin, 'parent_corrected');
  assert.equal(result.assignment.vocabulary[0].term.provenance.correctionExplanation, correction(0).corrections[0].correctionExplanation);
  const recreated = h.makeService(); await assert.rejects(recreated.readParentAssignment(h.token, { assignmentId: id }), { code: 'parent_locked' });
  const current = await recreated.unlock('123456');
  const fresh = await recreated.readParentAssignment(current, { assignmentId: id });
  assert.deepEqual(fresh.document, result); assert.equal(fresh.writeRevision, 3);
  assert.deepEqual(await recreated.saveParentCorrections(current, correction(3)), result); // no-op
});

test('malformed, stale and failed writes roll back; Mark All requires explicit declaration', async () => {
  const h = await harness(); const original = JSON.stringify(h.state());
  for (const request of [correction(1), { ...correction(0), corrections: [{ ...correction(0).corrections[0], correctionExplanation: ' ' }] },
    { ...correction(0), corrections: [{ ...correction(0).corrections[0], fieldPath: '/sources/0/originalText' }] },
    { ...correction(0), corrections: [{ ...correction(0).corrections[0], text: ' ' }] },
    { ...correction(0), contentRevision: 99 }]) {
    await assert.rejects(h.service.saveParentCorrections(h.token, request)); assert.equal(JSON.stringify(h.state()), original);
  }
  await assert.rejects(h.service.setFieldReview(h.token, { ...review(0), reviewed: 'false' }), { code: 'invalid_field' });
  await assert.rejects(h.service.markAllReviewed(h.token, { assignmentId: id, expectedWriteRevision: 0 }), { code: 'confirmation_required' });
  h.fail(true);
  await assert.rejects(h.service.saveParentCorrections(h.token, correction(0)), e => e.code === 'persistence_failed' && !e.message.includes('PRIVATE'));
  assert.equal(JSON.stringify(h.state()), original);
});

test('competing reviews consume only one revision and reject stale snapshots', async () => {
  const h = await harness();
  const results = await Promise.allSettled([h.service.setFieldReview(h.token, review(0)), h.service.setFieldReview(h.token, review(0))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'stale_document');
  assert.equal(h.state().assignments[0].writeRevision, 1);
});

test('unsupported envelopes, duplicate IDs and invalid field references fail without resets', async () => {
  for (const damage of [d => { d.writeRevision = null; }, d => { d.storageVersion = 2; }, d => { d.assignment.vocabulary[0].term.text = ' '; }]) {
    const h = await harness(); damage(h.state().assignments[0]); const before = JSON.stringify(h.state());
    await assert.rejects(h.service.setFieldReview(h.token, review(0)), { code: 'unsupported_document' });
    assert.equal(JSON.stringify(h.state()), before);
  }
  const h = await harness();
  await assert.rejects(h.service.setFieldReview(h.token, { ...review(0), fieldPaths: ['/missing'] }), { code: 'invalid_field' });
  h.state().assignments.push(clone(h.state().assignments[0])); const before = JSON.stringify(h.state());
  await assert.rejects(h.service.saveParentCorrections(h.token, correction(0)), { code: 'unsupported_document' });
  assert.equal(JSON.stringify(h.state()), before);
});

test('queued request cannot be changed by caller and supplementary origin remains distinct', async () => {
  const h = await harness(); const term = h.state().assignments[0].assignment.vocabulary[0].term;
  term.provenance.origin = 'ai_generated'; term.provenance.authorship = 'ai';
  const ready = deferred(); const release = deferred(); h.before(() => { ready.resolve(); return release.promise; });
  const request = correction(0); const pending = h.service.saveParentCorrections(h.token, request);
  await ready.promise; request.corrections[0].text = 'Changed after submission'; release.resolve();
  const result = await pending;
  assert.equal(result.assignment.vocabulary[0].term.text, correction(0).corrections[0].text);
  assert.equal(result.assignment.vocabulary[0].term.provenance.origin, 'ai_generated');
  assert.equal(result.assignment.vocabulary[0].term.provenance.authorship, 'ai');
});

for (const name of ['setFieldReview', 'markAllReviewed', 'saveParentCorrections']) {
  const input = () => name === 'setFieldReview' ? review(0) : name === 'saveParentCorrections' ? correction(0) :
    { assignmentId: id, expectedWriteRevision: 0, confirmReviewDeclaration: true };
  test(`${name} rejects forged, revoked, expired and replaced capabilities before transaction mutation`, async () => {
    for (const cause of ['forged', 'revoked', 'expired', 'replaced']) {
      const h = await harness(); const original = JSON.stringify(h.state().assignments);
      if (cause === 'forged') { await assert.rejects(h.service[name]({}, input()), { code: 'parent_locked' }); continue; }
      const ready = deferred(); const release = deferred();
      h.before(() => { ready.resolve(); return release.promise; });
      const pending = h.service[name](h.token, input()); const rejected = assert.rejects(pending, { code: 'parent_locked' });
      await ready.promise;
      if (cause === 'expired') h.advance(300000); else h.service.lock();
      h.before(null);
      const unlocking = cause === 'replaced' ? h.service.unlock('123456') : null;
      release.resolve(); await rejected;
      const current = unlocking && await unlocking;
      assert.equal(JSON.stringify(h.state().assignments), original);
      if (current) assert.equal((await h.service.listParentAssignments(current)).length, 1);
    }
  });
}

test('issued write completes atomically after revocation, suppresses result and preserves newer session on re-entry', async () => {
  const h = await harness(); const ready = deferred(); const release = deferred();
  h.after(() => { ready.resolve(); return release.promise; });
  const pending = h.service.saveParentCorrections(h.token, correction(0));
  const rejected = assert.rejects(pending, { code: 'parent_locked' });
  await ready.promise; h.service.lock(); h.after(null);
  const unlocking = h.service.unlock('123456'); release.resolve();
  await rejected; const current = await unlocking;
  const fresh = await h.service.readParentAssignment(current, { assignmentId: id });
  assert.equal(fresh.writeRevision, 1); assert.equal(fresh.document.contentRevision, 2);
  assert.equal(fresh.document.assignment.vocabulary[0].term.text, correction(0).corrections[0].text);
  await assert.rejects(h.service.setFieldReview(h.token, review(1)), { code: 'parent_locked' });
  await h.service.setFieldReview(current, review(1)); // stale old completion did not lock new capability
});

test('late completion with an already replaced session cannot lock or renew that new session', async () => {
  const h = await harness(); const ready = deferred(); const release = deferred();
  h.response(() => { ready.resolve(); return release.promise; });
  const pending = h.service.saveParentCorrections(h.token, correction(0)); const rejected = assert.rejects(pending, { code: 'parent_locked' });
  await ready.promise; h.response(null); h.service.lock();
  const newer = await h.service.unlock('123456'); h.advance(299999);
  release.resolve(); await rejected;
  await assert.rejects(h.service.saveParentCorrections(h.token, correction(1)), { code: 'parent_locked' });
  await h.service.listParentAssignments(newer); h.advance(1);
  await assert.rejects(h.service.listParentAssignments(newer), { code: 'parent_locked' });
});

test('development sample reload preserves corrected/reviewed data and production cannot mutate it', async () => {
  const h = await harness(); const sampleId = await h.service.loadDevelopmentSample(h.token);
  await h.service.saveParentCorrections(h.token, { ...correction(1), assignmentId: sampleId });
  await h.service.markAllReviewed(h.token, { assignmentId: sampleId, expectedWriteRevision: 2, confirmReviewDeclaration: true });
  const before = JSON.stringify(h.state().assignments);
  await h.service.loadDevelopmentSample(h.token); assert.equal(JSON.stringify(h.state().assignments), before);
  const production = h.makeService(false); const token = await production.unlock('123456');
  await assert.rejects(production.saveParentCorrections(token, { ...correction(3), assignmentId: sampleId }), { code: 'assignment_not_found' });
});

test('material corrections clear accepted evidence; student cannot forge supplementary correction claims', async () => {
  const h = await harness(); const d = h.state().assignments[0];
  d.assignment.reviewStatus = 'approved'; d.approval = { method: 'bulk_risk_acknowledged', contentRevision: 1,
    acceptedAt: '2026-11-11T00:00:00Z', riskAcknowledgementVersion: 1 };
  assert.equal((await h.service.readPractice(id)).eligibility.eligible, true);
  await h.service.saveParentCorrections(h.token, correction(0));
  assert.equal((await h.service.readPractice(id)).eligibility.eligible, false);
  const input = clone(fixture); input.id = 'student-claim'; input.vocabulary[0].term.provenance.correctionExplanation = 'Forged parent claim';
  await assert.rejects(h.service.submitAssignment(input), /cannot claim/);
});
