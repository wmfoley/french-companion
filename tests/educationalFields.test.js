const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../src/content/fixtures/grade4-reference.json');
const { enumerateEducationalFields } = require('../src/core/assignments/educationalFields');
const clone = value => JSON.parse(JSON.stringify(value));
const text = value => ({ text: value, provenance: { origin: 'illustrative', sourceIds: [], reviewStatus: 'pending_review', authorship: 'human' } });

test('enumerates every supplied educational field with evidence-compatible paths and nearest IDs', () => {
  const assignment = { schemaVersion: 1, id: 'lesson', title: 'Metadata', grade: 4, language: 'fr', reviewStatus: 'pending_review',
    instructions: [{ id: 'instruction', content: text('Lis') }],
    vocabulary: [{ id: 'word', term: text('mot'), definitionFr: text('définition'), exampleSentences: [text('exemple')] }],
    grammarConcepts: [{ id: 'grammar', label: text('règle'), explanationFr: text('explication'),
      examples: [{ id: 'example', adjective: text('prudent'), feminine: text('prudente'), adverb: text('prudemment') }] }],
    supportingMaterial: [{ id: 'note', kind: 'note', content: text('note') }, { id: 'asset', kind: 'local_asset', content: text('légende'), assetPath: 'assets/page.png' }] };
  const fields = enumerateEducationalFields(assignment);
  assert.deepEqual(fields.map(f => f.path), ['/instructions/0/content', '/vocabulary/0/term', '/vocabulary/0/definitionFr', '/vocabulary/0/exampleSentences/0',
    '/grammarConcepts/0/label', '/grammarConcepts/0/explanationFr', '/grammarConcepts/0/examples/0/adjective', '/grammarConcepts/0/examples/0/feminine',
    '/grammarConcepts/0/examples/0/adverb', '/supportingMaterial/0/content', '/supportingMaterial/1/content']);
  assert.deepEqual(fields.map(f => f.ownerId), ['instruction', 'word', 'word', 'word', 'grammar', 'grammar', 'example', 'example', 'example', 'note', 'asset']);
  assert.equal(fields[3].kind, 'example_sentence');
  assert.equal(fields[7].kind, 'feminine');
});

test('absent optional fields and metadata/source excerpts never become supplied review fields', () => {
  const assignment = clone(fixture); delete assignment.vocabulary[0].definitionFr;
  const fields = enumerateEducationalFields(assignment);
  assert.equal(fields.length, 19);
  assert.ok(!fields.some(f => f.path === '/vocabulary/0/definitionFr'));
  assert.ok(!fields.some(f => /sources|title|grade|week/.test(f.path)));
  const minimal = { schemaVersion: 1, id: 'empty', title: 'Empty', grade: 4, language: 'fr', reviewStatus: 'draft' };
  assert.deepEqual(enumerateEducationalFields(minimal), []);
});

test('descriptors preserve exact Unicode and cannot mutate frozen source/provenance', () => {
  const assignment = clone(fixture); assignment.vocabulary[0].term.text = '  ne\u0301gociateur  ';
  const before = JSON.stringify(assignment);
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }
  freeze(assignment);
  const fields = enumerateEducationalFields(assignment);
  assert.equal(fields.find(f => f.path === '/vocabulary/0/term').text, '  ne\u0301gociateur  ');
  fields[0].provenance.sourceIds.push('unrelated'); fields[0].text = 'changed';
  assert.equal(JSON.stringify(assignment), before);
});

test('invalid and sparse assignment content is rejected with validation details', () => {
  for (const value of [null, {}, { ...clone(fixture), vocabulary: Array(1) }]) {
    assert.throws(() => enumerateEducationalFields(value), error => error instanceof TypeError && error.errors.length > 0);
  }
});
