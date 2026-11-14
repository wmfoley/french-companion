// Memory-only Parent Area state. Service authorization remains the security boundary.
function createAssignmentReviewController({ service, getCapability = () => null, onLocked = () => {} }) {
  const empty = () => ({ view: 'home', list: [], detail: null, edit: null, confirmation: null, discard: null, busy: false, message: '' });
  let state = empty(); let epoch = 0; let running = null;
  const listeners = new Set();
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  function lock() { epoch++; running = null; state = empty(); listeners.forEach(listener => listener()); }
  function dirty() { return state.edit && (state.edit.text !== state.edit.originalText || state.edit.explanation !== state.edit.originalExplanation); }
  async function run(action, view) {
    if (running) return;
    const capability = getCapability();
    if (!capability) { lock(); return; }
    const operation = { epoch, capability }; running = operation;
    const current = () => running === operation && epoch === operation.epoch && getCapability() === capability;
    publish({ busy: true, message: '', ...(view ? { view, detail: null, edit: null, confirmation: null, discard: null, list: [] } : {}) });
    try { await action(capability, current); }
    catch (error) {
      if (!current()) return;
      if (error.code === 'parent_locked') { lock(); onLocked(); return; }
      if (error.code === 'stale_document' && state.detail) {
        const assignmentId = state.detail.document.assignment.id;
        publish({ detail: null, edit: null, confirmation: null, discard: null });
        try {
          const detail = await service.readParentAssignment(capability, { assignmentId });
          if (current()) publish({ view: 'detail', detail, message: 'This assignment changed. Latest saved content loaded; reconsider your edit or review before trying again.' });
        } catch (reloadError) {
          if (current()) {
            if (reloadError.code === 'parent_locked') { lock(); onLocked(); }
            else publish({ view: 'detail', message: 'Unable to reload the assignment. Return to the list and reopen it.' });
          }
        }
      } else publish({ message: error.code === 'unsupported_document' ? 'Stored assignment data is invalid or unsupported. Nothing was reset.' :
        error.code === 'persistence_failed' ? 'Unable to save or load locally. Reopen the assignment before retrying.' : 'Unable to complete this action. Check the content and confirmations, then reopen the assignment if needed.' });
    } finally { if (current()) { running = null; publish({ busy: false }); } }
  }
  async function list() {
    return run(async (capability, current) => {
      const items = await service.listParentAssignments(capability);
      if (current()) publish({ list: items });
    }, 'list');
  }
  async function open(assignmentId) {
    return run(async (capability, current) => {
      const detail = await service.readParentAssignment(capability, { assignmentId });
      if (current()) publish({ detail });
    }, 'detail');
  }
  function navigate(view) {
    if (running) return;
    if (dirty()) { publish({ discard: view }); return; }
    if (view === 'list') return list();
    publish({ view, edit: null, confirmation: null, discard: null, ...(view === 'home' ? { detail: null, list: [] } : {}) });
  }
  function editField(path) {
    if (running || !state.detail) return;
    if (state.edit?.path === path) return;
    const field = state.detail.fields.find(field => field.path === path);
    if (!field) return;
    if (dirty()) { publish({ discard: { editPath: path } }); return; }
    publish({ view: 'detail', confirmation: null, edit: { path, text: field.text, originalText: field.text,
      explanation: field.provenance.correctionExplanation || '', originalExplanation: field.provenance.correctionExplanation || '' } });
  }
  function confirm(kind) {
    if (running || !state.detail || state.view !== 'detail' || state.edit) return;
    if (!['all', 'detailed', 'risk'].includes(kind) || (kind === 'detailed' && !state.detail.review.ready)) return;
    publish({ confirmation: { kind, checked: false, noGaps: false } });
  }
  async function mutate(method, input, message) {
    if (!state.detail || running) return;
    const assignmentId = state.detail.document.assignment.id;
    const expectedWriteRevision = state.detail.writeRevision;
    return run(async (capability, current) => {
      await service[method](capability, { assignmentId, expectedWriteRevision, ...input });
      if (!current()) return;
      // Always reread persisted revisions, including after no-op saves.
      const detail = await service.readParentAssignment(capability, { assignmentId });
      if (current()) publish({ detail, message, edit: null, confirmation: null, discard: null, view: 'detail' });
    });
  }
  return {
    connect(readCapability, handleLock) { getCapability = readCapability; onLocked = handleLock; },
    snapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    lock, list, open, navigate, editField, confirm,
    changeEdit(key, value) { if (!running && state.edit && ['text', 'explanation'].includes(key)) publish({ edit: { ...state.edit, [key]: value } }); },
    changeConfirmation(key, value) { if (!running && state.confirmation && ['checked', 'noGaps'].includes(key)) publish({ confirmation: { ...state.confirmation, [key]: value === true } }); },
    cancelConfirmation() { if (!running) publish({ confirmation: null }); },
    keepEditing() { publish({ discard: null }); },
    discardEdits() {
      const target = state.discard; if (!target || running) return;
      publish({ edit: null, discard: null });
      return typeof target === 'object' ? editField(target.editPath) : navigate(target);
    },
    reviewField(path, reviewed = true) {
      if (state.edit) return;
      return mutate('setFieldReview', { fieldPaths: [path], reviewed }, 'Review saved.');
    },
    saveCorrection() {
      if (!state.edit || !state.edit.text.trim() || !state.edit.explanation.trim()) return;
      return mutate('saveParentCorrections', { corrections: [{ fieldPath: state.edit.path, text: state.edit.text, correctionExplanation: state.edit.explanation }] },
        'Correction saved. Review corrected fields again.');
    },
    submitConfirmation() {
      const confirmation = state.confirmation;
      if (!confirmation?.checked || (confirmation.kind === 'detailed' && !confirmation.noGaps)) return;
      if (confirmation.kind === 'all') return mutate('markAllReviewed', { confirmReviewDeclaration: true }, 'Fields reviewed. Approval is separate.');
      if (confirmation.kind === 'detailed') return mutate('approveReviewedAssignment', { confirmAcceptance: true, confirmNoKnownGaps: true }, 'Approved after review. Sources unchanged.');
      return mutate('approveWithoutDetailedReview', { acknowledgeRisk: true, confirmAcceptance: true }, 'Approved without detailed review.');
    },
  };
}
module.exports = { createAssignmentReviewController };
