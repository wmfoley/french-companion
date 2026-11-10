const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { validateAssignment } = require('../src/core/assignments/validateAssignment');
const { normalizeAssignment } = require('../src/core/assignments/normalizeAssignment');
const { gradeAnswer } = require('../src/core/exercises/gradeAnswer');

test('reference fixture is valid, pending review, and worksheet-unverified', () => {
  assert.deepEqual(validateAssignment(fixture), { valid: true, errors: [] });
  assert.equal(fixture.reviewStatus, 'pending_review');
  assert.ok(fixture.sources.every(s => s.fidelity === 'reported_teacher_content'));
  assert.deepEqual(fixture.instructions, []);
  assert.ok(fixture.vocabulary.every(item => item.exampleSentences.length === 0));
});

test('five terms and definitions preserve PRD wording exactly', () => {
  const expected = [
    ['un dirigeant', 'une personne qui dirige un groupe ou un pays'],
    ['un négociateur', 'une personne qui essaie de trouver un accord'],
    ['une crise', 'une période difficile ou dangereuse'],
    ['Chef Maquinna', 'une personne importante chez les Nuu-chah-nulth'],
    ['pacifique', 'qui favorise la paix et évite la violence'],
  ];
  assert.deepEqual(fixture.vocabulary.map(v => [v.term.text, v.definitionFr.text]), expected);
  const prd = fs.readFileSync(require.resolve('../docs/requirements/PRD_v0.1.md'), 'utf8');
  for (const [term, definition] of expected) assert.ok(prd.includes(`| ${term} | ${definition} |`));
  for (const source of fixture.sources) assert.ok(prd.includes(source.originalText), source.id);
});

test('grammar examples preserve the three PRD transformations', () => {
  assert.deepEqual(fixture.grammarConcepts[0].examples.map(e => [e.adjective.text, e.feminine.text, e.adverb.text]), [
    ['prudent', 'prudente', 'prudemment'], ['fréquent', 'fréquente', 'fréquemment'], ['patient', 'patiente', 'patiemment'],
  ]);
  assert.equal(fixture.grammarConcepts[0].explanationFr, undefined);
});

test('approval does not upgrade source fidelity or alter preserved excerpts', () => {
  const approved = normalizeAssignment(fixture);
  function approve(value) {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'reviewStatus')) value.reviewStatus = 'approved';
    for (const child of Object.values(value)) approve(child);
  }
  approve(approved);
  assert.equal(validateAssignment(approved).valid, true);
  assert.deepEqual(approved.sources, fixture.sources);
  assert.equal(fixture.reviewStatus, 'pending_review');
});

test('assignment normalization remains compatible with the existing accent-sensitive grader', () => {
  const normalized = normalizeAssignment(fixture);
  const expected = normalized.vocabulary[1].term.text;
  assert.equal(gradeAnswer(' UN NÉGOCIATEUR ', expected).isCorrect, true);
  assert.equal(gradeAnswer('un negociateur', expected).isCorrect, false);
});
