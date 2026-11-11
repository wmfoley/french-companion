// Presentation only: authoritative definitions and option membership remain unchanged.
function randomizePresentation(questions, random) {
  if (!Array.isArray(questions) || typeof random !== 'function') throw new TypeError('Invalid presentation inputs.');
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
    if (!question || !Array.isArray(question.optionItemIds)) throw new TypeError('Invalid presentation question.');
    return { ...question, optionItemIds: shuffle([...question.optionItemIds]) };
  });
  return shuffle(presentation);
}
module.exports = { randomizePresentation };
