const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { enumerateEducationalFields } = require('../src/core/assignments/educationalFields');
const { gradeAnswer } = require('../src/core/exercises/gradeAnswer');
const { generateVocabularyQuestions } = require('../src/core/exercises/vocabularyMultipleChoice');
const { generateTypedVocabularyQuestions: generate, validateTypedVocabularyQuestion: validate, resolveTypedVocabularyQuestion: resolve,
  gradeTypedVocabularyAnswer: grade, createTypedVocabularyResponse: create, submitTypedVocabularyAnswer: submit,
  resolveTypedVocabularyFeedback: feedback } = require('../src/core/exercises/typedVocabularyRecall');

const clone = value => JSON.parse(JSON.stringify(value));
const independent = { householdPolicy: { policyVersion: 1, revision: 1, practiceMode: 'allow_independent_practice', riskAcknowledgementVersion: 1 } };
function document() {
  return { storageVersion: 1, contentRevision: 1, writeRevision: 1, purpose: 'household_assignment',
    assignment: { ...clone(fixture), id: 'recall-lesson' }, approval: null };
}
// Existing acceptance receipts only: generation never asks the parent to repeat these actions.
function accepted(detailed = false) {
  const d = document(); d.assignment.reviewStatus = 'approved';
  d.approval = { method: detailed ? 'reviewed' : 'bulk_risk_acknowledged', contentRevision: 1, acceptedAt: '2026-11-14T00:00:00Z',
    ...(detailed ? { reviewedFieldPaths: enumerateEducationalFields(d.assignment).map(f => f.path) } : { riskAcknowledgementVersion: 1 }) };
  if (detailed) {
    function review(value) { if (!value || typeof value !== 'object') return; if (value.provenance) value.provenance.reviewStatus = 'approved'; Object.values(value).forEach(review); }
    review(d.assignment);
  }
  return d;
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function first(d = accepted(), options) { return generate(d, options).questions[0]; }
function pair(d, term, definition) { d.assignment.vocabulary = d.assignment.vocabulary.slice(0, 1); d.assignment.vocabulary[0].term.text = term; d.assignment.vocabulary[0].definitionFr.text = definition; return d; }

test('typed questions are deterministic references capped at five without mutating frozen sources', () => {
  const d = accepted(); const extra = clone(d.assignment.vocabulary[0]); extra.id = 'extra-word'; extra.term.text = 'un bateau'; extra.definitionFr.text = 'un moyen de transport sur eau';
  d.assignment.vocabulary.push(extra); const before = JSON.stringify(d); freeze(d);
  const result = generate(d); assert.equal(result.questions.length, 5); assert.deepEqual(generate(d), result);
  const reordered = clone(d); reordered.assignment.vocabulary.reverse();
  assert.deepEqual(generate(reordered).questions, result.questions);
  assert.deepEqual(result.questions.map(q => q.targetItemId), [...result.questions.map(q => q.targetItemId)].sort());
  for (const q of result.questions) {
    assert.deepEqual(Object.keys(q), ['schemaVersion', 'id', 'type', 'assignmentId', 'targetItemId', 'gradingPolicy']);
    assert.equal(q.type, 'typed_vocabulary_recall'); assert.equal(q.assignmentId, d.assignment.id); assert.equal(validate(q, d), undefined);
  }
  assert.equal(JSON.stringify(d), before);
});

test('existing detailed/bulk approval and independent policy require zero new parent steps or field reviews', () => {
  const legacy = accepted(); delete legacy.writeRevision;
  const corrected = accepted(); corrected.assignment.vocabulary[0].term.provenance.origin = 'parent_corrected';
  corrected.assignment.vocabulary[0].term.provenance.correctionExplanation = 'Previously saved parent correction.';
  for (const [d, options] of [[accepted(true), undefined], [accepted(false), undefined], [document(), independent], [legacy, undefined], [corrected, undefined]]) {
    const before = clone(d); assert.equal(generate(d, options).questions.length, 5); assert.deepEqual(d, before);
    if (d.approval?.method !== 'reviewed') assert.equal(d.assignment.vocabulary[0].term.provenance.reviewStatus, 'pending_review');
  }
  assert.equal(generate(document()).questions.length, 0);
  const d = accepted(); d.approval.contentRevision = 2; assert.equal(generate(d).questions.length, 0);
  assert.equal(generate(d, independent).questions.length, 5);
  assert.equal(generate(document(), { householdPolicy: { ...independent.householdPolicy, riskAcknowledgementVersion: 0 } }).questions.length, 0);
});

test('development reference demo requires explicit build capability; persisted sample stays excluded in production', () => {
  const d = document(); d.assignment = clone(fixture);
  assert.equal(generate(d, { mode: 'demo' }).questions.length, 0);
  assert.equal(generate(d, { mode: 'demo', development: true }).questions.length, 5);
  assert.equal(generate(d, independent).questions.length, 0);
  assert.equal(generate(accepted(), { mode: 'demo', development: true }).questions.length, 0);
  const sample = accepted(); sample.assignment.id = 'fc004n-development-sample'; sample.purpose = 'development_sample';
  assert.equal(generate(sample).questions.length, 0); assert.equal(generate(sample, { development: true }).questions.length, 5);
  sample.assignment.reviewStatus = 'pending_review'; sample.approval = null;
  assert.equal(generate(sample, { ...independent, development: true }).questions.length, 5);
  sample.purpose = 'household_assignment'; assert.equal(generate(sample, { ...independent, development: true }).questions.length, 0);
});

test('drafts, unsupported documents, invalid supplied pairs and generation options fail closed', () => {
  const d = document(); d.assignment.reviewStatus = 'draft'; assert.equal(generate(d, independent).questions.length, 0);
  for (const change of [x => { x.storageVersion = 2; }, x => { x.writeRevision = 0; }, x => { x.assignment.vocabulary[0].term.text = ' '; }, x => { x.assignment.vocabulary[0].definitionFr = null; }]) {
    const bad = accepted(); change(bad); assert.throws(() => generate(bad), TypeError);
  }
  for (const options of [null, [], { mode: 'other' }, { development: 'true' }, { approve: true }]) assert.throws(() => generate(accepted(), options), TypeError);
});

test('one or two eligible pairs need no multiple-choice option minimum; empty pools are diagnostic', () => {
  for (const count of [0, 1, 2]) {
    const d = accepted(); d.assignment.vocabulary = d.assignment.vocabulary.slice(0, count);
    const result = generate(d); assert.equal(result.questions.length, count);
    if (!count) assert.ok(result.diagnostics.some(x => x.code === 'no_questions'));
  }
});

test('missing definitions and supplementary terms/definitions are skipped without inventing content', () => {
  const d = accepted(); delete d.assignment.vocabulary[0].definitionFr;
  d.assignment.vocabulary[1].term.provenance.origin = 'ai_generated';
  d.assignment.vocabulary[2].definitionFr.provenance = { origin: 'illustrative', authorship: 'human', sourceIds: [], reviewStatus: 'pending_review' };
  const before = clone(d); const result = generate(d); assert.equal(result.questions.length, 2);
  assert.equal(result.diagnostics.filter(x => x.code === 'ineligible_content').length, 3); assert.deepEqual(d, before);
});

test('duplicate normalized term or definition groups exclude all members; accent distinctions remain', () => {
  for (const key of ['term', 'definitionFr']) {
    const d = accepted(); d.assignment.vocabulary[1][key].text = ` ${d.assignment.vocabulary[0][key].text.toUpperCase().normalize('NFD')} `;
    const result = generate(d); assert.equal(result.questions.length, 3); assert.equal(result.diagnostics.filter(x => x.code === 'ambiguous_content').length, 2);
  }
  const d = accepted(); d.assignment.vocabulary[0].term.text = 'un pré'; d.assignment.vocabulary[1].term.text = 'un pre';
  assert.equal(generate(d).questions.length, 5);
});

test('literal full-answer and narrowly article-stripped headword leakage is excluded', () => {
  for (const term of ['un dirigeant', 'une crise', 'le négociateur', 'la paix', "l'accord", 'l’accord', 'Chef Maquinna']) {
    const headword = term.replace(/^(?:(?:un|une|le|la)\s+|l['\u2019])/, '');
    for (const answer of [term, headword]) {
      const d = pair(accepted(), term, `Ceci signifie : (${answer.toUpperCase().normalize('NFD')}).`);
      const result = generate(d); assert.equal(result.questions.length, 0, term);
      assert.ok(result.diagnostics.some(x => x.code === 'answer_leakage'));
    }
  }
});

test('leakage checks escape regex punctuation and use Unicode boundaries without stemming or accent removal', () => {
  assert.equal(generate(pair(accepted(), 'un c++', 'Le c++ est mentionné.')).questions.length, 0);
  assert.equal(generate(pair(accepted(), 'une crise', 'On écrit crise-test.')).questions.length, 0);
  for (const definition of ['Une période difficile.', 'Le mot crises est au pluriel.', 'Le mot écrise est différent.']) {
    assert.equal(generate(pair(accepted(), 'une crise', definition)).questions.length, 1);
  }
  assert.equal(generate(pair(accepted(), 'un négociateur', 'Un negociateur sans accent.')).questions.length, 1);
});

test('question validation rejects foreign IDs, unknown policy/type, extra answer fields and unsafe targets', () => {
  const d = accepted(); const q = first(d);
  for (const change of [{ schemaVersion: 2 }, { id: 'other' }, { assignmentId: 'foreign' }, { targetItemId: 'absent' }, { type: 'dictation' }, { gradingPolicy: 'other' }, { expectedAnswer: 'leaked' }]) {
    assert.throws(() => validate({ ...q, ...change }, d), TypeError);
  }
  const changed = clone(d); changed.assignment.vocabulary.find(x => x.id === q.targetItemId).definitionFr.text = ' '; assert.throws(() => validate(q, changed), TypeError);
  const pending = clone(d); pending.approval = null; assert.throws(() => resolve(q, pending), TypeError);
});

test('prompt resolution exposes only the exact definition; feedback exposes term only for terminal state', () => {
  const d = accepted(); const q = first(d); const item = d.assignment.vocabulary.find(x => x.id === q.targetItemId);
  assert.deepEqual(resolve(q, d), { definition: item.definitionFr.text });
  const initial = create(q, d); assert.equal(feedback(initial, q, d), null);
  const wrong = submit(initial, q, d, 'incorrect'); assert.equal(feedback(wrong, q, d), null);
  const done = submit(wrong, q, d, 'toujours incorrect');
  assert.deepEqual(feedback(done, q, d), { correctTerm: item.term.text, definition: item.definitionFr.text });
});

test('grading reuses complete-term policy exactly and preserves the raw response', () => {
  const d = pair(accepted(), 'un négociateur', 'Une personne qui cherche un accord.'); const q = first(d);
  for (const response of ['un négociateur', ' UN NE\u0301GOCIATEUR ', 'négociateur', 'un negociateur', 'un  négociateur', 'un négociateur!', 'un\tnégociateur']) {
    assert.deepEqual(grade(q, d, response), gradeAnswer(response, 'un négociateur'));
  }
  assert.equal(grade(q, d, 'négociateur').isCorrect, false);
  for (const response of ['', ' \t', null, 2]) assert.throws(() => grade(q, d, response), TypeError);
});

test('blank submissions are exact no-ops and non-string submissions are rejected', () => {
  const d = accepted(); const q = first(d); const state = freeze(create(q, d));
  for (const text of ['', ' \t\n']) assert.equal(submit(state, q, d, text), state);
  for (const value of [null, undefined, 4, {}]) assert.throws(() => submit(state, q, d, value), TypeError);
  assert.equal(state.attempts.length, 0);
});

test('first-attempt success completes without a score and later submissions are ignored', () => {
  const d = accepted(); const q = first(d); const term = d.assignment.vocabulary.find(x => x.id === q.targetItemId).term.text;
  const initial = freeze(create(q, d)); const done = submit(initial, q, d, term);
  assert.equal(done.outcome, 'correct_first_attempt'); assert.equal(done.attempts.length, 1); assert.equal(initial.attempts.length, 0);
  assert.equal(submit(done, q, d, 'later'), done); assert.ok(!JSON.stringify(done).includes('score'));
});

test('unchanged, case-only, surrounding-whitespace and canonical-Unicode wrong retries consume no attempt', () => {
  const d = accepted(); const q = first(d); const wrong = freeze(submit(create(q, d), q, d, 'réponse incorrecte'));
  for (const text of ['', ' \t', 'réponse incorrecte', ' RÉPONSE INCORRECTE ', 're\u0301ponse incorrecte']) assert.equal(submit(wrong, q, d, text), wrong);
  assert.equal(wrong.attempts[0].response, 'réponse incorrecte'); assert.equal(wrong.outcome, null);
});

test('a significant edit permits second-attempt success, including restoring a missing accent', () => {
  const d = pair(accepted(), 'un négociateur', 'Une personne qui cherche un accord.'); const q = first(d);
  const wrong = freeze(submit(create(q, d), q, d, 'un negociateur'));
  const done = submit(wrong, q, d, 'un négociateur'); assert.equal(done.outcome, 'correct_second_attempt');
  assert.equal(done.attempts.length, 2); assert.equal(wrong.attempts.length, 1);
});

test('second significant incorrect attempt resolves and rejects a third without changing sources', () => {
  const d = freeze(accepted()); const q = first(d); const before = JSON.stringify(d);
  const wrong = submit(create(q, d), q, d, 'erreur');
  const done = freeze(submit(wrong, q, d, 'erreur!'));
  assert.equal(done.outcome, 'incorrect_after_two_attempts'); assert.equal(done.attempts.length, 2);
  assert.equal(submit(done, q, d, 'nouvel essai'), done); assert.equal(JSON.stringify(d), before);
});

test('forged attempts, stale question identities, impossible outcomes and repeated history fail without mutation', () => {
  const d = accepted(); const q = first(d); const wrong = submit(create(q, d), q, d, 'erreur');
  const malformed = [ { ...wrong, questionId: 'stale' }, { ...wrong, outcome: 'correct_first_attempt' },
    { ...wrong, attempts: [{ ...wrong.attempts[0], isCorrect: true }] },
    { ...wrong, attempts: [wrong.attempts[0], wrong.attempts[0]], outcome: 'incorrect_after_two_attempts' },
    { ...wrong, attempts: [wrong.attempts[0], wrong.attempts[0], wrong.attempts[0]] }, { ...wrong, attempts: Array(1) } ];
  for (const state of malformed) { const before = JSON.stringify(state); assert.throws(() => submit(state, q, d, 'new'), TypeError); assert.equal(JSON.stringify(state), before); }
});

test('old approval/content cannot authorize typed transitions; independent policy stays separate', () => {
  const d = accepted(); const q = first(d); const state = create(q, d);
  const changed = clone(d); changed.contentRevision = 2;
  assert.throws(() => submit(state, q, changed, 'answer'), TypeError);
  assert.equal(submit(state, q, changed, 'answer', independent).attempts.length, 1);
  assert.equal(changed.approval.contentRevision, 1);
});

test('fresh response creation resets prior outcomes and multiple-choice generation remains identical', () => {
  const d = accepted(); const before = clone(d); const mcOptions = { approval: d.approval, contentRevision: d.contentRevision };
  const mc = generateVocabularyQuestions(d.assignment, mcOptions); const q = first(d);
  submit(submit(create(q, d), q, d, 'first'), q, d, 'second');
  assert.deepEqual(create(q, d), { questionId: q.id, attempts: [], outcome: null });
  assert.deepEqual(generateVocabularyQuestions(d.assignment, mcOptions), mc); assert.deepEqual(d, before);
});
