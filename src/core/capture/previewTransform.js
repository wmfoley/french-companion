// Pure, immutable helpers. Worklet directives also allow these contracts on the UI runtime.
const PREVIEW_LIMITS = Object.freeze({ minScale: 1, maxScale: 4, zoomStep: 1.25, deadZone: 0.04 });

function aspectFit(imageWidth, imageHeight, viewportWidth, viewportHeight) {
  'worklet';
  if (![imageWidth, imageHeight, viewportWidth, viewportHeight].every(n => Number.isFinite(n) && n > 0)) return null;
  const factor = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight);
  if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(imageWidth * factor) || !Number.isFinite(imageHeight * factor)) return null;
  return { sourceWidth: imageWidth, sourceHeight: imageHeight,
    width: imageWidth * factor, height: imageHeight * factor, viewportWidth, viewportHeight };
}
function fitTransform() {
  'worklet';
  return { scale: 1, x: 0, y: 0 };
}
function panBounds(geometry, scale) {
  'worklet';
  return geometry ? { x: Math.max(0, (geometry.width * scale - geometry.viewportWidth) / 2),
    y: Math.max(0, (geometry.height * scale - geometry.viewportHeight) / 2) } : { x: 0, y: 0 };
}
function clampTransform(geometry, transform) {
  'worklet';
  if (!geometry || ![transform.scale, transform.x, transform.y].every(Number.isFinite)) return fitTransform();
  const scale = Math.max(PREVIEW_LIMITS.minScale, Math.min(PREVIEW_LIMITS.maxScale, transform.scale));
  const bounds = panBounds(geometry, scale);
  return { scale, x: Math.max(-bounds.x, Math.min(bounds.x, transform.x)) || 0,
    y: Math.max(-bounds.y, Math.min(bounds.y, transform.y)) || 0 };
}
function pinchRatio(relativeScale) {
  'worklet';
  if (!Number.isFinite(relativeScale) || relativeScale <= 0) return 1;
  const log = Math.log(relativeScale);
  const adjusted = Math.max(0, Math.abs(log) - Math.log(1 + PREVIEW_LIMITS.deadZone));
  return Math.exp(Math.sign(log) * adjusted);
}
// Coordinates are viewport-local points. Translation is in screen points, NOT scaled image units.
function zoomAt(geometry, transform, nextScale, from, to = from) {
  'worklet';
  if (!geometry || ![nextScale, from.x, from.y, to.x, to.y].every(Number.isFinite)) return transform;
  const scale = Math.max(PREVIEW_LIMITS.minScale, Math.min(PREVIEW_LIMITS.maxScale, nextScale));
  const cx = geometry.viewportWidth / 2; const cy = geometry.viewportHeight / 2;
  const ratio = scale / transform.scale;
  return clampTransform(geometry, { scale,
    x: to.x - cx - (from.x - cx - transform.x) * ratio,
    y: to.y - cy - (from.y - cy - transform.y) * ratio });
}
function resetPreview(previous, geometry, pageKey, reason = 'fit') {
  'worklet';
  return { geometry, pageKey, generation: (previous?.generation || 0) + 1,
    transform: fitTransform(), owner: null, cursor: null,
    geometryRequest: previous?.geometryRequest || 0,
    lastResetReason: reason, lastGeometryUpdateReason: previous?.lastGeometryUpdateReason || 'initial' };
}
function beginTransform(state, generation, owner, point, pointers, rawScale = 1) {
  'worklet';
  if (!state.geometry || generation !== state.generation || !['pan', 'pinch'].includes(owner) ||
      ![point.x, point.y, rawScale].every(Number.isFinite) || rawScale <= 0 || pointers < 2 ||
      (state.owner === 'pinch' && owner === 'pan')) return state;
  return { ...state, owner, cursor: { x: point.x, y: point.y, pointers, rawBase: rawScale, effective: 1 } };
}
// Worklet factories capture dependencies during module initialization. Keep callees
// before callers: normal JS function hoisting does not apply to captured closures.
function rebaseTransform(state, generation, owner) {
  'worklet';
  return generation === state.generation && state.owner === owner ? { ...state, cursor: null } : state;
}
function updateTransform(state, generation, owner, point, pointers, rawScale = 1) {
  'worklet';
  if (generation !== state.generation || !state.geometry || ![point.x, point.y, rawScale].every(Number.isFinite) ||
      rawScale <= 0 || (state.owner === 'pinch' && owner === 'pan')) return state;
  if (pointers < 2) return rebaseTransform(state, generation, owner);
  if (state.owner !== owner || !state.cursor || pointers !== state.cursor.pointers) {
    return beginTransform(state, generation, owner, point, pointers, rawScale);
  }
  const last = state.cursor;
  const effective = owner === 'pinch' ? pinchRatio(rawScale / last.rawBase) : 1;
  const transform = zoomAt(state.geometry, state.transform,
    state.transform.scale * effective / last.effective, last, point);
  // Advance the cursor even when bounded: reversing never has an overshoot distance to repay.
  return { ...state, transform, cursor: { ...last, x: point.x, y: point.y, effective } };
}
function endTransform(state, generation, owner) {
  'worklet';
  return generation === state.generation && state.owner === owner ? { ...state, owner: null, cursor: null } : state;
}
// Request numbers order queued JS-to-UI geometry work independently of gesture generations.
function applyPreviewGeometry(state, geometry, pageKey, request, reason) {
  'worklet';
  if (!Number.isSafeInteger(request) || request <= state.geometryRequest) return state;
  return { ...resetPreview(state, geometry, pageKey, reason), geometryRequest: request,
    lastGeometryUpdateReason: reason };
}
function geometrySnapshot(state, serial) {
  'worklet';
  const g = state.geometry; const t = state.transform;
  const limits = panBounds(g, t.scale);
  return { serial, pageKey: state.pageKey, generation: state.generation, owner: state.owner || 'none',
    sourceWidth: g?.sourceWidth || 0, sourceHeight: g?.sourceHeight || 0,
    aspectRatio: g?.sourceWidth > 0 && g.sourceHeight > 0 ? g.sourceWidth / g.sourceHeight : 0,
    viewportWidth: g?.viewportWidth || 0, viewportHeight: g?.viewportHeight || 0,
    fittedWidth: g?.width || 0, fittedHeight: g?.height || 0,
    transformedWidth: g ? g.width * t.scale : 0, transformedHeight: g ? g.height * t.scale : 0,
    scale: t.scale, x: t.x, y: t.y, limitX: limits.x, limitY: limits.y,
    lastResetReason: state.lastResetReason, lastGeometryUpdateReason: state.lastGeometryUpdateReason };
}

module.exports = { PREVIEW_LIMITS, aspectFit, fitTransform, panBounds, clampTransform, pinchRatio,
  zoomAt, resetPreview, beginTransform, updateTransform, endTransform, rebaseTransform,
  applyPreviewGeometry, geometrySnapshot };
