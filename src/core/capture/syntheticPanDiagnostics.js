// Development synthetic probe only: fixed numeric fields, no raw events or identifiers.
function newPanDiagnostic(rawX = 0, rawY = 0, pointers = 0) {
  'worklet';
  return { updates: 0, rawChanges: 0, appliedChanges: 0, invalidInputs: 0, pinchOwned: 0, stale: 0,
    lowPointers: 0, rebases: 0,
    rawX: Number.isFinite(rawX) ? Math.max(-100000, Math.min(100000, rawX)) : 0,
    rawY: Number.isFinite(rawY) ? Math.max(-100000, Math.min(100000, rawY)) : 0,
    pointers: Number.isFinite(pointers) ? Math.max(0, Math.min(10, pointers)) : 0, owner: 'none' };
}
function samplePanDiagnostic(previous, before, after, generation, rawX, rawY, pointers) {
  'worklet';
  const x = Number.isFinite(rawX) ? rawX : 0;
  const y = Number.isFinite(rawY) ? rawY : 0;
  return { updates: Math.min(999, previous.updates + 1),
    invalidInputs: Math.min(999, previous.invalidInputs +
      (![rawX, rawY, pointers].every(Number.isFinite) ? 1 : 0)),
    rawChanges: Math.min(999, previous.rawChanges + (x !== previous.rawX || y !== previous.rawY ? 1 : 0)),
    appliedChanges: Math.min(999, previous.appliedChanges +
      (before.transform.x !== after.transform.x || before.transform.y !== after.transform.y ? 1 : 0)),
    pinchOwned: Math.min(999, previous.pinchOwned + (before.owner === 'pinch' ? 1 : 0)),
    stale: Math.min(999, previous.stale + (generation !== before.generation ? 1 : 0)),
    lowPointers: Math.min(999, previous.lowPointers + (pointers < 2 ? 1 : 0)),
    rebases: Math.min(999, previous.rebases +
      (before.owner !== 'pinch' && (!before.cursor || pointers !== before.cursor.pointers) ? 1 : 0)),
    rawX: Math.max(-100000, Math.min(100000, x)), rawY: Math.max(-100000, Math.min(100000, y)),
    pointers: Number.isFinite(pointers) ? Math.max(0, Math.min(10, pointers)) : 0,
    owner: ['pan', 'pinch'].includes(before.owner) ? before.owner : 'none' };
}
// Native timestamps, when supplied, reject older layout events. Missing timestamps
// cannot establish native ordering; page identity and queued-request guards still apply.
function acceptSyntheticLayout(previous, selectedKey, eventKey, width, height, timestamp) {
  if (selectedKey !== eventKey || ![width, height].every(n => Number.isFinite(n) && n > 0)) return previous;
  const time = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : previous?.timestamp || 0;
  if (previous && time < previous.timestamp) return previous;
  return { width, height, timestamp: time };
}
function formatGeometrySnapshot(s) {
  if (!s || ![s.serial, s.aspectRatio, s.viewportWidth, s.viewportHeight, s.fittedWidth,
    s.fittedHeight, s.scale, s.transformedWidth, s.transformedHeight, s.x, s.y, s.limitX, s.limitY].every(Number.isFinite)) {
    return 'Geometry snapshot waiting for layout/refresh. Reload Capture Proof if needed.';
  }
  return `Captured state #${s.serial} (not live during gestures)\nShape ${s.pageKey}; source ${s.sourceWidth} x ${s.sourceHeight}; aspect ${s.aspectRatio.toFixed(6)}\n` +
    `Viewport ${s.viewportWidth.toFixed(3)} x ${s.viewportHeight.toFixed(3)}; fitted ${s.fittedWidth.toFixed(3)} x ${s.fittedHeight.toFixed(3)}\n` +
    `Scale ${s.scale.toFixed(6)}; transformed ${s.transformedWidth.toFixed(3)} x ${s.transformedHeight.toFixed(3)}\n` +
    `Translation (${s.x.toFixed(3)}, ${s.y.toFixed(3)}); limits (${s.limitX.toFixed(3)}, ${s.limitY.toFixed(3)})\n` +
    `Generation ${s.generation}; owner ${s.owner}; last reset ${s.lastResetReason}; last geometry ${s.lastGeometryUpdateReason}`;
}
module.exports = { newPanDiagnostic, samplePanDiagnostic, acceptSyntheticLayout, formatGeometrySnapshot };
