// Development capture viewer lifecycle only. No files, native APIs or persistence.
function validPreviewPage(page) {
  return !!page && typeof page.uri === 'string' && page.uri.startsWith('file://') &&
    [page.width, page.height].every(n => Number.isFinite(n) && n > 0);
}
function selectPreviewPage(selection, pages, delta = 0) {
  if (!Number.isSafeInteger(delta)) throw new Error('Invalid preview selection');
  if (!Array.isArray(pages) || !pages.length) return { pages, index: 0 };
  const index = selection?.pages === pages && Number.isSafeInteger(selection.index) ? selection.index : 0;
  return { pages, index: Math.max(0, Math.min(pages.length - 1, index + delta)) };
}
function createImagePreviewLifecycle({ imageIdentity, method, pageNumber, width, height }) {
  const identity = /^local-image-\d+$/.test(imageIdentity) ? imageIdentity : 'local-image';
  const source = ['photo', 'scanner'].includes(method) ? method : 'unknown';
  let active = true; let epoch = 1; let status = 'loading'; let stamp = 0; let sequence = 0;
  const counts = { mounts: 1, unmounts: 0, loadStarts: 0, loads: 0, errors: 0, retries: 0, stale: 0 };
  let decodedWidth = 0; let decodedHeight = 0;
  const events = [];
  function record(kind) { events.push({ sequence: ++sequence, kind }); if (events.length > 40) events.shift(); }
  function bump(key) { counts[key] = Math.min(999, counts[key] + 1); }
  function current(token) {
    if (!active || token?.epoch !== epoch) { bump('stale'); record('stale-event'); return false; }
    return true;
  }
  record('mount');
  return {
    token: () => ({ epoch }),
    active: () => active,
    open() {
      if (!active) { active = true; epoch++; status = 'loading'; bump('mounts'); record('mount'); }
      return { epoch };
    },
    retry() {
      if (!active) return null;
      epoch++; status = 'loading'; bump('retries'); record('retry'); return { epoch };
    },
    start(token) {
      if (!current(token)) return false;
      status = 'loading'; bump('loadStarts'); record('load-start'); return true;
    },
    load(token, outcome, w = 0, h = 0) {
      if (!current(token)) return false;
      if (outcome === 'success') {
        status = 'loaded'; bump('loads'); record('load-success');
        decodedWidth = Number.isFinite(w) && w > 0 ? w : 0;
        decodedHeight = Number.isFinite(h) && h > 0 ? h : 0;
      } else { status = 'error'; bump('errors'); record('load-error'); }
      return true;
    },
    layout(timestamp) {
      if (!active) { bump('stale'); record('stale-layout'); return false; }
      if (Number.isFinite(timestamp) && timestamp > 0) {
        if (timestamp < stamp) { bump('stale'); record('stale-layout'); return false; }
        stamp = timestamp;
      }
      return true;
    },
    close() {
      if (active) { active = false; epoch++; status = 'closed'; bump('unmounts'); record('unmount'); }
    },
    snapshot() {
      return { imageIdentity: identity, method: source,
        pageNumber: Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber : 0,
        sourceWidth: Number.isFinite(width) && width > 0 ? width : 0,
        sourceHeight: Number.isFinite(height) && height > 0 ? height : 0, decodedWidth, decodedHeight,
        status, epoch, ...counts, events: events.map(event => ({ ...event })) };
    },
  };
}
module.exports = { validPreviewPage, selectPreviewPage, createImagePreviewLifecycle };
