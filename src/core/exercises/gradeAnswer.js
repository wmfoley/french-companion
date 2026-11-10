// This sample policy ignores case and surrounding whitespace only.
// NFC equates composed/decomposed accents without removing accents.
function normalizeAnswer(value) {
  return value.normalize('NFC').trim().toLocaleLowerCase('fr-CA').normalize('NFC');
}

function gradeAnswer(response, expectedAnswer) {
  if (typeof response !== 'string' || typeof expectedAnswer !== 'string') {
    throw new TypeError('Answers must be strings.');
  }

  const isCorrect = normalizeAnswer(response) === normalizeAnswer(expectedAnswer);
  return { response, isCorrect, mistake: isCorrect ? null : 'incorrect_spelling' };
}

module.exports = { gradeAnswer };
