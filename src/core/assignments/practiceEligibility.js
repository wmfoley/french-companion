const { validateAssignmentDocument, validateApprovalEvidence } = require('./assignmentDocument');

const STRICT = 'require_parent_approval';
const INDEPENDENT = 'allow_independent_practice';

function validPolicy(policy) {
  return Boolean(policy && policy.policyVersion === 1 && Number.isSafeInteger(policy.revision) && policy.revision > 0 &&
    [STRICT, INDEPENDENT].includes(policy.practiceMode) &&
    (policy.practiceMode !== INDEPENDENT || policy.riskAcknowledgementVersion === 1));
}

function evaluatePracticeEligibility({ assignmentDocument: document, householdPolicy, development = false }) {
  const deny = reason => ({ eligible: false, reason, requiresUnreviewedNotice: false });
  if (!validateAssignmentDocument(document).valid) return deny('invalid_assignment');
  const sample = document.purpose === 'development_sample' && document.assignment.id === 'fc004n-development-sample';
  if ((sample && !development) || (!sample && document.purpose !== 'household_assignment') || document.assignment.id === 'grade4-reference-001' ||
    (document.assignment.id === 'fc004n-development-sample' && !sample)) return deny('reference_demo_only');
  if (document.assignment.reviewStatus === 'draft') return deny('assignment_not_ready');
  const accepted = validateApprovalEvidence(document).valid;
  const independent = validPolicy(householdPolicy) && householdPolicy.practiceMode === INDEPENDENT;
  if (!accepted && !independent) return deny('approval_required');
  return { eligible: true, reason: accepted ? 'parent_accepted' : 'household_independent_policy', requiresUnreviewedNotice: !accepted };
}

module.exports = { STRICT, INDEPENDENT, validPolicy, evaluatePracticeEligibility };
