// Presentation only: authoritative definitions and option membership remain unchanged.
function randomizePresentation(questions, random, exerciseType = 'vocabulary_multiple_choice') {
  if (!Array.isArray(questions) || typeof random !== 'function') throw new TypeError('Invalid presentation inputs.');
  if (!['vocabulary_multiple_choice', 'typed_vocabulary_recall'].includes(exerciseType)) throw new TypeError('Unsupported presentation exercise type.');
  function shuffle(copy) {
    for (let i = copy.length - 1; i > 0; i--) {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError('Random values must be in [0, 1).');
      const j = Math.floor(value * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  const presentation = questions.map(question => {
    if (exerciseType === 'typed_vocabulary_recall') {
      if (!question || question.type !== exerciseType || question.schemaVersion !== 1 ||
        question.gradingPolicy !== 'typed-vocabulary-two-attempts-v1' ||
        typeof question.assignmentId !== 'string' || !question.assignmentId || typeof question.targetItemId !== 'string' || !question.targetItemId ||
        question.id !== `vocabulary-recall-${question.targetItemId}` || Object.keys(question).length !== 6 ||
        Object.keys(question).some(key => !['schemaVersion', 'id', 'type', 'assignmentId', 'targetItemId', 'gradingPolicy'].includes(key))) throw new TypeError('Invalid typed presentation question.');
      return { ...question };
    }
    if (question?.type !== undefined && question.type !== exerciseType) throw new TypeError('Presentation exercise type mismatch.');
    if (!question || !Array.isArray(question.optionItemIds)) throw new TypeError('Invalid presentation question.');
    return { ...question, optionItemIds: shuffle([...question.optionItemIds]) };
  });
  return shuffle(presentation);
}
module.exports = { randomizePresentation };
