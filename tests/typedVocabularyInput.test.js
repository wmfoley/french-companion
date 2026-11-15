const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { canSubmitTypedDraft } = require('../src/components/typedVocabularyInput');

test('blank and non-string drafts never enable explicit Submit', () => {
  for (const draft of ['', ' \t\n', null, undefined, 1]) assert.equal(canSubmitTypedDraft(draft), false);
  assert.equal(canSubmitTypedDraft('un négociateur'), true);
});
test('first-miss draft stays unchanged and equivalent edits cannot enable another attempt', () => {
  const response = Object.freeze({ attempts: Object.freeze([Object.freeze({ response: 'un negociateur', isCorrect: false })]), outcome: null });
  for (const draft of ['un negociateur', ' UN NEGOCIATEUR ']) assert.equal(canSubmitTypedDraft(draft, response), false);
  assert.equal(canSubmitTypedDraft('un négociateur', response), true);
  assert.equal(response.attempts[0].response, 'un negociateur');
});
test('canonical Unicode differences are harmless while significant edits remain available', () => {
  const response = { attempts: [{ response: 'un négociateur', isCorrect: false }], outcome: null };
  assert.equal(canSubmitTypedDraft('un ne\u0301gociateur', response), false);
  for (const draft of ['un negociateur', 'un  négociateur', 'un négociateur!']) assert.equal(canSubmitTypedDraft(draft, response), true);
});
test('busy and all terminal outcomes disable further submission', () => {
  assert.equal(canSubmitTypedDraft('une crise', undefined, true), false);
  for (const outcome of ['correct_first_attempt', 'correct_second_attempt', 'incorrect_after_two_attempts']) {
    assert.equal(canSubmitTypedDraft('une crise', { attempts: [], outcome }), false);
  }
});
test('native input configuration retains editable cursor entry without application correction or answer hints', () => {
  const source = readFileSync(require.resolve('../src/components/TypedVocabularyQuestion.js'), 'utf8');
  const input = source.match(/<TextInput[\s\S]*?\/>/)[0];
  for (const contract of ['value={draft}', 'onChangeText={setDraft}', 'autoCorrect={false}', 'autoCapitalize="none"', 'spellCheck={false}', 'autoComplete="off"',
    'keyboardType="default"', 'submitBehavior="submit"', 'blurOnSubmit={false}', 'onSubmitEditing={submit}', 'editable={!completed}']) assert.ok(input.includes(contract), contract);
  assert.ok(!/correctTerm|expected|autoFocus|selection=|onChangeText=\{submit\}/.test(input));
  assert.ok(source.includes('submitting.current') && source.includes('mounted.current'));
});
