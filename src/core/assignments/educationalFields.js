const { validateAssignment } = require('./validateAssignment');

/** Enumerate only schema-defined, supplied educational fields; descriptors are independent copies. */
function enumerateEducationalFields(assignment) {
  const result = validateAssignment(assignment);
  if (!result.valid) {
    const error = new TypeError('Invalid assignment.');
    error.errors = result.errors;
    throw error;
  }
  const fields = [];
  function add(value, path, ownerId, kind) {
    if (value !== undefined) fields.push({ path, ownerId, kind, text: value.text,
      provenance: JSON.parse(JSON.stringify(value.provenance)) });
  }
  (assignment.instructions || []).forEach((item, i) => add(item.content, `/instructions/${i}/content`, item.id, 'instruction'));
  (assignment.vocabulary || []).forEach((item, i) => {
    add(item.term, `/vocabulary/${i}/term`, item.id, 'term');
    add(item.definitionFr, `/vocabulary/${i}/definitionFr`, item.id, 'definition');
    (item.exampleSentences || []).forEach((value, j) => add(value, `/vocabulary/${i}/exampleSentences/${j}`, item.id, 'example_sentence'));
  });
  (assignment.grammarConcepts || []).forEach((item, i) => {
    add(item.label, `/grammarConcepts/${i}/label`, item.id, 'grammar_label');
    add(item.explanationFr, `/grammarConcepts/${i}/explanationFr`, item.id, 'grammar_explanation');
    (item.examples || []).forEach((example, j) => {
      for (const key of ['adjective', 'feminine', 'adverb']) add(example[key], `/grammarConcepts/${i}/examples/${j}/${key}`, example.id, key);
    });
  });
  (assignment.supportingMaterial || []).forEach((item, i) => add(item.content, `/supportingMaterial/${i}/content`, item.id, 'supporting_content'));
  return fields;
}
module.exports = { enumerateEducationalFields };
