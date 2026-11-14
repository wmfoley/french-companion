const { validateAssignment } = require('./validateAssignment');
const { enumerateEducationalFields } = require('./educationalFields');

const plain = value => Boolean(value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype);
const positiveRevision = value => Number.isSafeInteger(value) && value > 0;
function jsonValue(value, ancestors = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if ((!plain(value) && !Array.isArray(value)) || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = (Array.isArray(value) ? Array.from(value) : Object.values(value)).every(child => jsonValue(child, ancestors));
  ancestors.delete(value);
  return valid;
}
function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value.slice(0, 10);
}
function revisionError(code) { const error = new TypeError(code); error.code = code; return error; }

function getWriteRevision(document) {
  if (!plain(document)) throw revisionError('invalid_document');
  if (!Object.hasOwn(document, 'writeRevision')) return 0;
  if (!positiveRevision(document.writeRevision)) throw revisionError('invalid_write_revision');
  return document.writeRevision;
}

/** Shape validation is deliberately separate from whether approval evidence authorizes strict practice. */
function validateAssignmentDocument(document) {
  const errors = [];
  const add = (path, code) => errors.push({ path, code });
  if (!plain(document)) return { valid: false, errors: [{ path: '$', code: 'expected_object' }] };
  const keys = ['storageVersion', 'contentRevision', 'writeRevision', 'purpose', 'assignment', 'approval'];
  for (const key of Object.keys(document)) if (!keys.includes(key)) add(`$.${key}`, 'unknown_field');
  if (document.storageVersion !== 1) add('$.storageVersion', 'unsupported_storage_version');
  if (!positiveRevision(document.contentRevision)) add('$.contentRevision', 'invalid_content_revision');
  try { getWriteRevision(document); } catch { add('$.writeRevision', 'invalid_write_revision'); }
  if (!['household_assignment', 'development_sample'].includes(document.purpose)) add('$.purpose', 'unsupported_purpose');
  if (Object.hasOwn(document, 'approval') && !jsonValue(document.approval)) add('$.approval', 'expected_json_value');
  for (const error of validateAssignment(document.assignment).errors) add(`$.assignment${error.path.slice(1)}`, error.code);
  return { valid: errors.length === 0, errors };
}

function assertWriteRevision(document, expected) {
  const result = validateAssignmentDocument(document);
  if (!result.valid) { const error = revisionError('invalid_document'); error.errors = result.errors; throw error; }
  if (!Number.isSafeInteger(expected) || expected < 0) throw revisionError('invalid_expected_revision');
  if (getWriteRevision(document) !== expected) throw revisionError('stale_document');
}

function assessDetailedReviewReadiness(assignment) {
  const fields = enumerateEducationalFields(assignment);
  const fieldPaths = fields.map(field => field.path);
  const reviewedFieldPaths = fields.filter(field => field.provenance.reviewStatus === 'approved').map(field => field.path);
  const unreviewedFieldPaths = fields.filter(field => field.provenance.reviewStatus !== 'approved').map(field => field.path);
  const gaps = [];
  if (!fields.length) gaps.push({ path: '', code: 'no_educational_content' });
  (assignment.vocabulary || []).forEach((item, i) => {
    if (item.definitionFr === undefined) gaps.push({ path: `/vocabulary/${i}/definitionFr`, code: 'missing_definition' });
  });
  return { fieldPaths, reviewedFieldPaths, unreviewedFieldPaths, gaps, ready: !gaps.length && !unreviewedFieldPaths.length };
}

function validateApprovalEvidence(document) {
  const result = validateAssignmentDocument(document);
  if (!result.valid) return result;
  const errors = [];
  const add = code => errors.push({ path: '$.approval', code });
  const approval = document.approval;
  if (!plain(approval)) return { valid: false, errors: [{ path: '$.approval', code: 'missing_or_invalid_approval' }] };
  if (document.assignment.reviewStatus !== 'approved') add('assignment_not_approved');
  if (!positiveRevision(approval.contentRevision) || approval.contentRevision !== document.contentRevision) add('approval_revision_mismatch');
  if (!validTimestamp(approval.acceptedAt)) add('invalid_accepted_at');
  const keys = ['method', 'contentRevision', 'acceptedAt'];
  if (approval.method === 'reviewed') {
    keys.push('reviewedFieldPaths');
    const readiness = assessDetailedReviewReadiness(document.assignment);
    const paths = approval.reviewedFieldPaths;
    if (!readiness.ready) add('review_not_ready');
    if (!Array.isArray(paths) || paths.length !== readiness.fieldPaths.length || new Set(paths).size !== paths.length ||
      !readiness.fieldPaths.every(path => paths.includes(path)) || !paths.length) add('invalid_review_coverage');
  } else if (approval.method === 'bulk_risk_acknowledged') {
    keys.push('riskAcknowledgementVersion');
    if (approval.riskAcknowledgementVersion !== 1) add('risk_acknowledgement_required');
  } else add('invalid_approval_method');
  if (Object.keys(approval).some(key => !keys.includes(key))) add('unexpected_approval_field');
  return { valid: errors.length === 0, errors };
}

module.exports = { validateAssignmentDocument, getWriteRevision, assertWriteRevision, validateApprovalEvidence, assessDetailedReviewReadiness };
