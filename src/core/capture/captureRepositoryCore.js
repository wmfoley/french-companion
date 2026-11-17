// Pure data contracts only. No storage, hashing, authorization or file operations.
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const copy = value => JSON.parse(JSON.stringify(value));
const id = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
function shape(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).sort().join('|') !== keys.slice().sort().join('|')) fail('invalid_record');
}
function unique(rows) {
  if (!Array.isArray(rows) || rows.some(row => !row || !id(row.id)) || new Set(rows.map(row => row.id)).size !== rows.length) fail('invalid_identity');
}
function validateCapacity(result) {
  shape(result, ['availableBytes', 'requiredBytes', 'warning']);
  if (![result.availableBytes, result.requiredBytes].every(integer) || typeof result.warning !== 'boolean') fail('invalid_capacity');
  return { sufficient: result.availableBytes >= result.requiredBytes, warning: result.warning };
}
function validateManifest(m) {
  try {
    shape(m, ['schemaVersion', 'revision', 'captures', 'pages', 'assets', 'bindings', 'availability', 'intents',
      ...(Object.hasOwn(m, 'cleanupIntents') ? ['cleanupIntents'] : [])]);
    if (m.schemaVersion !== 1) fail('unsupported_schema');
    if (!integer(m.revision) || !m.revision) fail('invalid_revision');
    for (const key of ['captures', 'pages', 'assets', 'bindings', 'availability', 'intents']) unique(m[key]);
    const all = [...m.captures, ...m.pages, ...m.assets, ...m.bindings, ...m.intents];
    if (new Set(all.map(r => r.id)).size !== all.length) fail('duplicate_identity');
    for (const c of m.captures) {
      shape(c, ['id', 'status', 'updatedAt', 'pageIds']);
      if (!['draft', 'saved'].includes(c.status) || !integer(c.updatedAt) || !Array.isArray(c.pageIds) ||
        c.pageIds.length > 20 || (c.status === 'saved' && !c.pageIds.length) || new Set(c.pageIds).size !== c.pageIds.length ||
        c.pageIds.some(p => !m.pages.some(page => page.id === p && page.captureId === c.id))) fail('invalid_capture');
    }
    for (const p of m.pages) {
      shape(p, ['id', 'captureId', 'currentAssetId']);
      if (!m.captures.some(c => c.id === p.captureId && c.pageIds.includes(p.id)) ||
        !m.assets.some(a => a.id === p.currentAssetId && a.pageId === p.id)) fail('invalid_page');
    }
    for (const a of m.assets) {
      shape(a, ['id', 'pageId', 'method', 'width', 'height', 'bytes', 'mime', 'fileKey', 'sha256']);
      if (!m.pages.some(p => p.id === a.pageId) || !['camera', 'document_scanner'].includes(a.method) ||
        ![a.width, a.height, a.bytes].every(n => integer(n) && n > 0) ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(a.mime) || a.fileKey !== a.id ||
        typeof a.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(a.sha256)) fail('invalid_asset');
    }
    if (m.availability.length !== m.assets.length) fail('invalid_availability');
    for (const a of m.availability) {
      shape(a, ['id', 'status', 'integrity']);
      if (!m.assets.some(asset => asset.id === a.id) || !['available', 'unexpectedly_missing', 'intentionally_deleted'].includes(a.status) ||
        !['unknown', 'verified', 'corrupt'].includes(a.integrity)) fail('invalid_availability');
    }
    for (const b of m.bindings) {
      shape(b, ['id', 'assignmentId', 'sourceId', 'contentRevision', 'assetId']);
      if (![b.assignmentId, b.sourceId].every(id) || !integer(b.contentRevision) || !b.contentRevision ||
        !m.assets.some(a => a.id === b.assetId)) fail('invalid_binding');
    }
    for (const i of m.intents) {
      shape(i, ['id', 'assetId', 'phase', 'issuedAt', 'completedAt', 'bindingIds']);
      const availability = m.availability.find(a => a.id === i.assetId);
      if (!availability || !['pending', 'complete'].includes(i.phase) || !integer(i.issuedAt) ||
        (i.phase === 'pending' ? i.completedAt !== null || availability.status === 'intentionally_deleted' :
          !integer(i.completedAt) || i.completedAt < i.issuedAt || availability.status !== 'intentionally_deleted') ||
        !Array.isArray(i.bindingIds) || new Set(i.bindingIds).size !== i.bindingIds.length ||
        i.bindingIds.some(b => !m.bindings.some(binding => binding.id === b && binding.assetId === i.assetId)) ||
        m.bindings.filter(b => b.assetId === i.assetId).some(b => !i.bindingIds.includes(b.id))) fail('invalid_intent');
    }
    if (new Set(m.intents.map(i => i.assetId)).size !== m.intents.length ||
      m.availability.some(a => a.status === 'intentionally_deleted' && !m.intents.some(i => i.assetId === a.id && i.phase === 'complete'))) fail('invalid_tombstone');
    const cleanups = m.cleanupIntents || [];
    unique(cleanups);
    const reserved = new Set(all.map(r => r.id));
    for (const i of cleanups) {
      shape(i, ['id', 'captureId', 'phase', 'issuedAt', 'completedAt', 'referenceEpoch', 'snapshot']);
      if (reserved.has(i.id)) fail('duplicate_identity'); reserved.add(i.id);
      if (!['pending', 'complete'].includes(i.phase) || !integer(i.issuedAt) || !integer(i.referenceEpoch) ||
        !i.snapshot || Object.hasOwn(i.snapshot, 'cleanupIntents') || !validateManifest(i.snapshot).valid ||
        i.snapshot.captures.length !== 1 || i.snapshot.captures[0].id !== i.captureId ||
        i.snapshot.captures[0].status !== 'draft' || i.snapshot.bindings.length ||
        i.snapshot.intents.some(intent => intent.phase !== 'complete') ||
        i.issuedAt < i.snapshot.captures[0].updatedAt + DRAFT_TTL_MS) fail('invalid_cleanup');
      if (i.phase === 'pending') {
        if (i.completedAt !== null || JSON.stringify(canonical(captureSnapshot(m, i.captureId))) !==
          JSON.stringify(canonical(i.snapshot))) fail('cleanup_conflict');
      } else {
        if (!integer(i.completedAt) || i.completedAt < i.issuedAt) fail('invalid_cleanup');
        for (const row of [...i.snapshot.captures, ...i.snapshot.pages, ...i.snapshot.assets, ...i.snapshot.intents]) {
          if (reserved.has(row.id)) fail('duplicate_identity'); reserved.add(row.id);
        }
      }
    }
    if (new Set(cleanups.map(i => i.captureId)).size !== cleanups.length) fail('invalid_cleanup');
    return { valid: true, errors: [] };
  } catch (error) { return { valid: false, errors: [error.code || 'invalid_record'] }; }
}
function assertManifest(m) { const v = validateManifest(m); if (!v.valid) fail(v.errors[0]); }
function emptyManifest() { return { schemaVersion: 1, revision: 1, captures: [], pages: [], assets: [], bindings: [], availability: [], intents: [], cleanupIntents: [] }; }
function captureSnapshot(m, captureId) {
  const captures = m.captures.filter(c => c.id === captureId);
  const pages = m.pages.filter(p => p.captureId === captureId);
  const assets = m.assets.filter(a => pages.some(p => p.id === a.pageId));
  return { schemaVersion: 1, revision: 1, captures, pages, assets,
    bindings: m.bindings.filter(b => assets.some(a => a.id === b.assetId)),
    availability: m.availability.filter(a => assets.some(asset => asset.id === a.id)),
    intents: m.intents.filter(i => assets.some(a => a.id === i.assetId)) };
}
// Adapter facts, NOT an authorization receipt. Only a trusted coordinator may supply these.
function cleanupEvidence(m, evidence) {
  shape(evidence, ['manifestRevision', 'referenceEpoch', 'referencesComplete', 'protectedAssetIds', 'pendingCaptureIds']);
  if (evidence.manifestRevision !== m.revision) fail('stale_evidence');
  if (evidence.referencesComplete !== true || !integer(evidence.referenceEpoch)) fail('incomplete_references');
  if (![evidence.protectedAssetIds, evidence.pendingCaptureIds].every(list => Array.isArray(list) && list.every(id))) fail('invalid_retention_context');
}
function deletionImpact(m, assetId, referencesComplete) {
  assertManifest(m);
  if (referencesComplete !== true) fail('incomplete_references');
  if (!m.assets.some(a => a.id === assetId)) fail('asset_not_found');
  const bindings = m.bindings.filter(b => b.assetId === assetId);
  return { assetId, expectedRevision: m.revision, bindingIds: bindings.map(b => b.id).sort(),
    assignmentIds: [...new Set(bindings.map(b => b.assignmentId))].sort() };
}
function draftExpiry(m, captureId, { now, referencesComplete, protectedAssetIds, pendingCaptureIds }) {
  assertManifest(m);
  if (typeof now !== 'function' || !Array.isArray(protectedAssetIds) || !Array.isArray(pendingCaptureIds) ||
    ![...protectedAssetIds, ...pendingCaptureIds].every(id)) fail('invalid_retention_context');
  const time = now(); if (!integer(time)) fail('invalid_time');
  const c = m.captures.find(c => c.id === captureId); if (!c) fail('capture_not_found');
  const assets = m.assets.filter(a => m.pages.some(p => p.id === a.pageId && p.captureId === c.id)).map(a => a.id);
  const eligible = referencesComplete === true && c.status === 'draft' && time >= c.updatedAt + DRAFT_TTL_MS &&
    !pendingCaptureIds.includes(c.id) && !(m.cleanupIntents || []).some(i => i.captureId === c.id && i.phase === 'pending') &&
    !assets.some(a => protectedAssetIds.includes(a) || m.bindings.some(b => b.assetId === a) || m.intents.some(i => i.assetId === a && i.phase === 'pending'));
  return { eligible, assetIds: eligible ? assets : [] };
}
function createRepositoryCore({ newId, now }) {
  if (typeof newId !== 'function' || typeof now !== 'function') fail('invalid_dependencies');
  function fresh(m) {
    const next = newId();
    const history = (m.cleanupIntents || []).flatMap(i => [i, ...i.snapshot.captures, ...i.snapshot.pages, ...i.snapshot.assets, ...i.snapshot.intents]);
    if (!id(next) || [...m.captures, ...m.pages, ...m.assets, ...m.bindings, ...m.intents, ...history].some(r => r.id === next)) fail('duplicate_identity');
    return next;
  }
  function time() { const n = now(); if (!integer(n)) fail('invalid_time'); return n; }
  function mutate(input, expectedRevision, action) {
    assertManifest(input); if (expectedRevision !== input.revision) fail('stale_revision');
    const m = copy(input); action(m); m.revision++; assertManifest(m); return m;
  }
  function addAsset(m, pageId, metadata) {
    shape(metadata, ['method', 'width', 'height', 'bytes', 'mime', 'sha256']);
    const assetId = fresh(m);
    m.assets.push({ id: assetId, pageId, ...copy(metadata), fileKey: assetId });
    m.availability.push({ id: assetId, status: 'available', integrity: 'verified' });
    return assetId;
  }
  return {
    beginDraftCleanup: (m, r, captureId, evidence) => mutate(m, r, m => {
      cleanupEvidence(m, evidence);
      const issuedAt = time();
      if (!draftExpiry(m, captureId, { ...evidence, now: () => issuedAt }).eligible) fail('cleanup_ineligible');
      const intent = { id: fresh(m), captureId, phase: 'pending', issuedAt, completedAt: null,
        referenceEpoch: evidence.referenceEpoch, snapshot: copy(captureSnapshot(m, captureId)) };
      (m.cleanupIntents ||= []).push(intent);
    }),
    completeDraftCleanup: (input, r, intentId, evidence, absenceConfirmed) => {
      assertManifest(input); if (r !== input.revision) fail('stale_revision');
      cleanupEvidence(input, evidence);
      const i = (input.cleanupIntents || []).find(i => i.id === intentId);
      if (!i || absenceConfirmed !== true || evidence.referenceEpoch < i.referenceEpoch) fail('invalid_cleanup');
      if (i.phase === 'complete') return copy(input); // Exact no-op, including revision/time.
      return mutate(input, r, m => {
        const intent = m.cleanupIntents.find(i => i.id === intentId);
        // Ignore this operation's own core intent, not any external unresolved operations.
        const candidate = { ...m, cleanupIntents: m.cleanupIntents.filter(i => i.id !== intentId) };
        const completedAt = time();
        if (!draftExpiry(candidate, intent.captureId, { ...evidence, now: () => completedAt }).eligible) fail('cleanup_ineligible');
        const s = intent.snapshot;
        m.captures = m.captures.filter(c => c.id !== intent.captureId);
        m.pages = m.pages.filter(p => !s.pages.some(old => old.id === p.id));
        m.assets = m.assets.filter(a => !s.assets.some(old => old.id === a.id));
        m.availability = m.availability.filter(a => !s.assets.some(old => old.id === a.id));
        m.intents = m.intents.filter(i => !s.intents.some(old => old.id === i.id));
        intent.phase = 'complete'; intent.completedAt = completedAt;
      });
    },
    createCapture: (m, r) => mutate(m, r, m => { m.captures.push({ id: fresh(m), status: 'draft', updatedAt: time(), pageIds: [] }); }),
    addPage: (m, r, captureId, metadata) => mutate(m, r, m => {
      const c = m.captures.find(c => c.id === captureId); if (!c || c.status !== 'draft' || c.pageIds.length >= 20) fail('invalid_transition');
      const p = { id: fresh(m), captureId, currentAssetId: '' }; m.pages.push(p);
      p.currentAssetId = addAsset(m, p.id, metadata); c.pageIds.push(p.id); c.updatedAt = time();
    }),
    save: (m, r, captureId) => mutate(m, r, m => {
      const c = m.captures.find(c => c.id === captureId); if (!c || c.status !== 'draft' || !c.pageIds.length || c.pageIds.some(p => {
        const a = m.availability.find(a => a.id === m.pages.find(page => page.id === p).currentAssetId);
        return a.status !== 'available' || a.integrity !== 'verified' || m.intents.some(i => i.assetId === a.id);
      })) fail('invalid_transition'); c.status = 'saved'; c.updatedAt = time();
    }),
    reorder: (m, r, captureId, pageIds) => mutate(m, r, m => {
      const c = m.captures.find(c => c.id === captureId);
      if (!c || !Array.isArray(pageIds) || pageIds.length !== c.pageIds.length || new Set(pageIds).size !== pageIds.length || pageIds.some(p => !c.pageIds.includes(p))) fail('invalid_order');
      c.pageIds = pageIds.slice(); c.updatedAt = time();
    }),
    retake: (m, r, pageId, metadata) => mutate(m, r, m => {
      const p = m.pages.find(p => p.id === pageId); if (!p) fail('page_not_found');
      p.currentAssetId = addAsset(m, pageId, metadata); m.captures.find(c => c.id === p.captureId).updatedAt = time();
    }),
    bind: (m, r, binding) => mutate(m, r, m => {
      shape(binding, ['assignmentId', 'sourceId', 'contentRevision', 'assetId']);
      const asset = m.assets.find(a => a.id === binding.assetId);
      if (!asset || !m.captures.some(c => c.status === 'saved' && c.pageIds.includes(asset.pageId)) ||
        !m.availability.some(a => a.id === asset.id && a.status === 'available' && a.integrity === 'verified') ||
        m.intents.some(i => i.assetId === asset.id)) fail('invalid_transition');
      m.bindings.push({ id: fresh(m), ...copy(binding) });
    }),
    observe: (m, r, assetId, status, integrity) => mutate(m, r, m => {
      const a = m.availability.find(a => a.id === assetId);
      if (!a || a.status === 'intentionally_deleted' || m.intents.some(i => i.assetId === assetId) || !['available', 'unexpectedly_missing'].includes(status)) fail('invalid_transition');
      a.status = status; a.integrity = integrity;
    }),
    beginDeletion: (m, r, impact, referencesComplete) => mutate(m, r, m => {
      const current = deletionImpact(m, impact.assetId, referencesComplete);
      if (JSON.stringify(current) !== JSON.stringify(impact) || m.intents.some(i => i.assetId === impact.assetId)) fail('stale_impact');
      m.intents.push({ id: fresh(m), assetId: impact.assetId, phase: 'pending', issuedAt: time(), completedAt: null, bindingIds: current.bindingIds });
    }),
    completeDeletion: (m, r, intentId, absenceConfirmed) => mutate(m, r, m => {
      const i = m.intents.find(i => i.id === intentId);
      if (!i || i.phase !== 'pending' || absenceConfirmed !== true) fail('invalid_transition');
      i.phase = 'complete'; i.completedAt = time(); m.availability.find(a => a.id === i.assetId).status = 'intentionally_deleted';
    }),
  };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function serialize(m) { assertManifest(m); return JSON.stringify(canonical(m)); }
function deserialize(text) { let m; try { m = JSON.parse(text); } catch { fail('invalid_json'); } assertManifest(m); return m; }
function pageWarning(m, captureId) { assertManifest(m); const c = m.captures.find(c => c.id === captureId); if (!c) fail('capture_not_found'); return c.pageIds.length >= 10; }
module.exports = { DRAFT_TTL_MS, emptyManifest, validateManifest, createRepositoryCore, deletionImpact, draftExpiry, validateCapacity, serialize, deserialize, pageWarning };
