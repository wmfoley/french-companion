const { validateAssignment } = require('./validateAssignment');

/** Canonical comparison only; stored source and educational text stay unchanged. */
function normalizeTextForComparison(text) {
  if (typeof text !== 'string') throw new TypeError('Text must be a string.');
  return text.normalize('NFC');
}

/** Return an independent JSON data copy with collection defaults; never infer approval. */
function normalizeAssignment(value) {
  const result = validateAssignment(value);
  if (!result.valid) {
    const error = new TypeError('Invalid assignment.');
    error.errors = result.errors;
    throw error;
  }
  const copy = JSON.parse(JSON.stringify(value));
  for (const key of ['sources', 'instructions', 'vocabulary', 'grammarConcepts', 'supportingMaterial']) copy[key] ??= [];
  for (const item of copy.vocabulary) item.exampleSentences ??= [];
  for (const concept of copy.grammarConcepts) concept.examples ??= [];
  return copy;
}

module.exports = { normalizeAssignment, normalizeTextForComparison };
