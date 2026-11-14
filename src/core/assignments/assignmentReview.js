const { enumerateEducationalFields } = require('./educationalFields');
const { assertWriteRevision, getWriteRevision, validateAssignmentDocument, validateApprovalEvidence } = require('./assignmentDocument');

function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
const clone = value => JSON.parse(JSON.stringify(value));
// Call only after exact membership in the schema-enumerated field map has been checked.
function fieldAt(assignment, path) { return path.slice(1).split('/').reduce((value, key) => value[key], assignment); }
function checkedPaths(paths, fields) {
  if (!Array.isArray(paths) || !paths.length || new Set(paths).size !== paths.length || Array.from(paths).some(path => !fields.some(field => field.path === path))) fail('invalid_field');
}
function finish(document, next, changed, material = false) {
  if (changed) {
    const revision = getWriteRevision(document);
    if (revision === Number.MAX_SAFE_INTEGER || (material && document.contentRevision === Number.MAX_SAFE_INTEGER)) fail('revision_overflow');
    next.writeRevision = revision + 1;
    if (material) next.contentRevision++;
  }
  if (!validateAssignmentDocument(next).valid) fail('invalid_document');
  return { document: next, changed };
}
function applyFieldReview(document, { expectedWriteRevision, fieldPaths, reviewed = true } = {}) {
  assertWriteRevision(document, expectedWriteRevision);
  if (typeof reviewed !== 'boolean') fail('invalid_field');
  const fields = enumerateEducationalFields(document.assignment);
  checkedPaths(fieldPaths, fields);
  const next = clone(document);
  let changed = false;
  for (const path of fieldPaths) {
    const field = fieldAt(next.assignment, path);
    const status = reviewed ? 'approved' : 'pending_review';
    if (field.provenance.reviewStatus !== status) { field.provenance.reviewStatus = status; changed = true; }
  }
  // Never repair invalid evidence implicitly; withdrawing coverage also clears detailed acceptance.
  if (changed && next.approval != null && (!validateApprovalEvidence(document).valid || !validateApprovalEvidence(next).valid)) {
    next.approval = null;
    next.assignment.reviewStatus = 'pending_review';
  }
  return finish(document, next, changed);
}
function applyMarkAllReviewed(document, { expectedWriteRevision, confirmReviewDeclaration } = {}) {
  assertWriteRevision(document, expectedWriteRevision);
  if (confirmReviewDeclaration !== true) fail('confirmation_required');
  const paths = enumerateEducationalFields(document.assignment).map(field => field.path);
  return paths.length ? applyFieldReview(document, { expectedWriteRevision, fieldPaths: paths }) : finish(document, clone(document), false);
}
function applyParentCorrections(document, { expectedWriteRevision, corrections } = {}) {
  assertWriteRevision(document, expectedWriteRevision);
  if (!Array.isArray(corrections) || !corrections.length) fail('invalid_correction');
  const fields = enumerateEducationalFields(document.assignment);
  if (Array.from(corrections).some(change => !change || Object.getPrototypeOf(change) !== Object.prototype ||
    Object.keys(change).some(key => !['fieldPath', 'text', 'correctionExplanation'].includes(key)) ||
    typeof change.text !== 'string' || !change.text.trim() || typeof change.correctionExplanation !== 'string' || !change.correctionExplanation.trim())) fail('invalid_correction');
  checkedPaths(corrections.map(change => change.fieldPath), fields);
  const next = clone(document);
  let changed = false;
  for (const change of corrections) {
    const field = fieldAt(next.assignment, change.fieldPath);
    const origin = ['teacher', 'parent_corrected'].includes(field.provenance.origin) ? 'parent_corrected' : field.provenance.origin;
    const material = field.text !== change.text || field.provenance.origin !== origin || field.provenance.correctionExplanation !== change.correctionExplanation;
    if (!material) continue;
    changed = true;
    field.text = change.text;
    field.provenance.origin = origin;
    field.provenance.correctionExplanation = change.correctionExplanation;
    field.provenance.reviewStatus = 'pending_review';
  }
  if (changed) {
    next.assignment.reviewStatus = 'pending_review';
    next.approval = null;
  }
  return finish(document, next, changed, changed);
}
module.exports = { applyFieldReview, applyMarkAllReviewed, applyParentCorrections };
