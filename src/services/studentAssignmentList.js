// Presentation only. The household service owns eligibility and practice access.
function assignmentStatus(item) {
  if (item.eligible === true) return item.requiresUnreviewedNotice
    ? 'Prête à pratiquer — pas encore revue par un parent.' : 'Prête à pratiquer';
  const explanations = {
    approval_required: 'Un parent doit revoir cette leçon avant la pratique.',
    assignment_not_ready: 'Cette leçon n’est pas encore prête pour la pratique.',
    invalid_assignment: 'Cette leçon est indisponible. Demande de l’aide à un parent.',
    reference_demo_only: 'Ce contenu de démonstration n’est pas disponible pour la pratique.',
  };
  return Object.hasOwn(explanations, item.reason) ? explanations[item.reason] : 'Cette leçon n’est pas disponible pour le moment.';
}

function createStudentAssignmentList({ service }) {
  let active = false; let revision = 0;
  let state = { status: 'loading', items: [] };
  const listeners = new Set();
  function publish(next) { state = next; listeners.forEach(listener => listener()); }
  async function refresh() {
    if (!active) return;
    const operation = ++revision;
    // Remove old eligibility while reading; a failed refresh cannot leave Start links.
    publish({ status: 'loading', items: [] });
    try {
      const items = await service.listPracticeAssignments();
      if (!active || operation !== revision) return;
      publish({ status: 'ready', items: items.map(item => ({ id: item.id, title: item.title,
        eligible: item.eligible === true, explanation: assignmentStatus(item),
        reviewRequired: item.eligible === false && item.reason === 'approval_required' })) });
    } catch {
      if (active && operation === revision) publish({ status: 'error', items: [] });
    }
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot: () => state,
    enter() { active = true; return refresh(); },
    refresh,
    pause() { revision++; publish({ status: 'loading', items: [] }); },
    leave() { active = false; revision++; publish({ status: 'loading', items: [] }); },
  };
}

module.exports = { assignmentStatus, createStudentAssignmentList };
