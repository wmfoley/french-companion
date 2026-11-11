const fixture = require('./fixtures/grade4-reference.json');
function createDevelopmentSample() {
  const assignment = JSON.parse(JSON.stringify(fixture));
  assignment.id = 'fc004n-development-sample';
  assignment.title = 'Exemple de développement — vocabulaire';
  return assignment;
}
module.exports = { createDevelopmentSample };
