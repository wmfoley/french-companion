const test = require('node:test');
const assert = require('node:assert/strict');
const { PREVIEW_LIMITS, aspectFit, fitTransform, panBounds, clampTransform, pinchRatio, zoomAt,
  resetPreview, beginTransform, updateTransform, endTransform, rebaseTransform,
  applyPreviewGeometry, geometrySnapshot } = require('../src/core/capture/previewTransform');
const near = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const point = (x, y) => ({ x, y });
const geometry = aspectFit(1000, 1000, 300, 300);
const initial = () => resetPreview(null, geometry, 'synthetic-a');
const enlarged = () => ({ ...initial(), transform: { scale: 2, x: 0, y: 0 } });
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

for (const [label, iw, ih, vw, vh, bw, bh] of [
  ['portrait', 900, 1200, 400, 300, 225, 300],
  ['landscape', 1200, 900, 300, 400, 300, 225],
  ['square', 800, 800, 300, 400, 300, 300],
  ['narrow', 10, 10000, 400, 300, 0.3, 300],
  ['wide', 10000, 10, 400, 300, 400, 0.4],
  ['smaller than viewport', 20, 10, 400, 300, 400, 200],
]) test(`aspect fit: ${label}, centred and proportional`, () => {
  const g = aspectFit(iw, ih, vw, vh);
  near(g.width, bw); near(g.height, bh); near(g.width / g.height, iw / ih);
  const t = clampTransform(g, { scale: 1, x: 900, y: -900 });
  assert.deepEqual(t, fitTransform());
  assert.ok((vw - g.width) / 2 >= -1e-8 && (vh - g.height) / 2 >= -1e-8);
});

test('invalid, zero and unrepresentable dimensions have no usable geometry', () => {
  for (const value of [0, -1, NaN, Infinity, undefined, '300']) {
    assert.equal(aspectFit(value, 100, 300, 300), null);
    assert.equal(aspectFit(100, 100, 300, value), null);
  }
  assert.equal(aspectFit(1e-320, 1e-320, 1e300, 1e300), null);
  assert.deepEqual(clampTransform(null, { scale: 3, x: 10, y: 10 }), fitTransform());
});
test('central trial constants and malformed transforms fail safely', () => {
  assert.deepEqual(PREVIEW_LIMITS, { minScale: 1, maxScale: 4, zoomStep: 1.25, deadZone: 0.04 });
  assert.deepEqual(clampTransform(geometry, { scale: Infinity, x: 1, y: 1 }), fitTransform());
  assert.equal(clampTransform(geometry, { scale: 100, x: 0, y: 0 }).scale, 4);
  assert.equal(clampTransform(geometry, { scale: 0.5, x: 0, y: 0 }).scale, 1);
});
test('reported portrait geometry has exact expected 1x, 2x, 4x limits', () => {
  const g = aspectFit(900, 1200, 640, 300);
  assert.deepEqual(panBounds(g, 1), { x: 0, y: 0 });
  assert.deepEqual(panBounds(g, 2), { x: 0, y: 150 });
  assert.deepEqual(panBounds(g, 4), { x: 130, y: 450 });
  const limits = panBounds(g, 617 / 300);
  near(limits.x, 0); near(limits.y, 158.5);
  const centred = clampTransform(g, { scale: 617 / 300, x: 1000, y: 1000 });
  near(centred.x, 0); near(centred.y, 158.5);
  near(g.width * (617 / 300), 462.75);
  assert.deepEqual(panBounds(aspectFit(1200, 900, 640, 300), 4), { x: 480, y: 450 });
});
test('38x300 is rounded intentional tall geometry with its preserved source aspect', () => {
  const s = resetPreview(null, aspectFit(200, 1600, 640, 300), 'tall', 'shape-button');
  const snapshot = geometrySnapshot(s, 1);
  near(snapshot.fittedWidth, 37.5); near(snapshot.fittedHeight, 300);
  assert.equal(snapshot.fittedWidth.toFixed(0), '38');
  assert.equal(snapshot.pageKey, 'tall'); near(snapshot.aspectRatio, 0.125);
  assert.equal(snapshot.sourceWidth, 200); assert.equal(snapshot.sourceHeight, 1600);
});
test('page aspect change resets Fit and metadata together; Fit preserves last geometry reason', () => {
  let s = applyPreviewGeometry(initial(), aspectFit(900, 1200, 640, 300), 'portrait', 1, 'initial-layout');
  s = { ...s, transform: { scale: 4, x: 70, y: 90 } };
  s = applyPreviewGeometry(s, aspectFit(1200, 900, 640, 300), 'landscape', 2, 'shape-button');
  const snap = geometrySnapshot(s, 2);
  assert.equal(snap.pageKey, 'landscape'); near(snap.aspectRatio, 4 / 3);
  assert.equal(snap.fittedWidth, 400); assert.equal(snap.fittedHeight, 300);
  assert.deepEqual(s.transform, fitTransform());
  assert.equal(snap.lastResetReason, 'shape-button'); assert.equal(snap.lastGeometryUpdateReason, 'shape-button');
  s = resetPreview(s, s.geometry, s.pageKey, 'fit-button');
  assert.equal(s.lastResetReason, 'fit-button'); assert.equal(s.lastGeometryUpdateReason, 'shape-button');
});
test('older queued geometry requests and gestures cannot overwrite newer page or viewport', () => {
  let s = initial(); const oldGesture = s.generation;
  s = applyPreviewGeometry(s, aspectFit(1200, 900, 640, 300), 'landscape', 2, 'shape-button');
  assert.equal(applyPreviewGeometry(s, geometry, 'old-page', 1, 'old-layout'), s);
  assert.equal(updateTransform(s, oldGesture, 'pan', point(90, 90), 2), s);
  s = applyPreviewGeometry(s, aspectFit(1200, 900, 300, 640), 'landscape', 3, 'viewport-layout');
  assert.equal(applyPreviewGeometry(s, geometry, 'landscape', 2, 'old-layout'), s);
  assert.equal(applyPreviewGeometry(s, geometry, 'landscape', NaN, 'bad'), s);
  assert.deepEqual(s.transform, fitTransform());
  assert.equal(geometrySnapshot(s, 9).viewportWidth, 300);
});
test('pointer activity preserves source identity, geometry and reset provenance', () => {
  let s = applyPreviewGeometry(initial(), geometry, 'square', 1, 'shape-button');
  const g = s.geometry; const generation = s.generation;
  s = { ...s, transform: { scale: 2, x: 0, y: 0 } };
  s = beginTransform(s, generation, 'pan', point(0, 0), 2);
  s = updateTransform(s, generation, 'pan', point(10, 20), 2);
  s = updateTransform(s, generation, 'pan', point(1000, 2000), 3);
  const snap = geometrySnapshot(s, 5);
  assert.equal(s.geometry, g); assert.equal(snap.pageKey, 'square'); near(snap.aspectRatio, 1);
  assert.equal(snap.lastGeometryUpdateReason, 'shape-button'); assert.equal(snap.owner, 'pan');
  assert.equal(snap.generation, generation); near(snap.x, 10); near(snap.y, 20);
});
test('single captured diagnostic display derives all fields from one immutable transform state', () => {
  const { formatGeometrySnapshot } = require('../src/core/capture/syntheticPanDiagnostics');
  const s = freeze({ ...resetPreview(null, aspectFit(900, 1200, 640, 300), 'portrait', 'fit-button'),
    transform: { scale: 617 / 300, x: 0, y: 10 } });
  const snap = freeze(geometrySnapshot(s, 10)); const text = formatGeometrySnapshot(snap);
  assert.match(text, /Shape portrait; source 900 x 1200/);
  assert.match(text, /fitted 225.000 x 300.000/);
  assert.match(text, /Scale 2.056667; transformed 462.750 x 617.000/);
  assert.match(text, /limits \(0.000, 158.500\)/);
  assert.match(text, /not live during gestures/);
  assert.match(text, /last reset fit-button/);
  assert.equal(snap.serial, 10); near(snap.x, 0); near(snap.y, 10);
  assert.match(formatGeometrySnapshot({ scale: 1, geometry: s.geometry }), /waiting for layout\/refresh/);
});
test('all four edges are covered exactly with no blank strip on overflowing axes', () => {
  for (const g of [geometry, aspectFit(900, 1200, 600, 300), aspectFit(1200, 900, 300, 600)]) {
    for (const scale of [1, 1.25, 2, 4]) {
      const bounds = panBounds(g, scale);
      for (const signX of [-1, 1]) for (const signY of [-1, 1]) {
        const t = clampTransform(g, { scale, x: signX * 1e6, y: signY * 1e6 });
        near(t.x, signX * bounds.x); near(t.y, signY * bounds.y);
        for (const [size, viewport, shift, sign] of [[g.width, g.viewportWidth, t.x, signX], [g.height, g.viewportHeight, t.y, signY]]) {
          const left = viewport / 2 + shift - size * scale / 2;
          const right = viewport / 2 + shift + size * scale / 2;
          if (size * scale >= viewport) {
            assert.ok(left <= 1e-8 && right >= viewport - 1e-8);
            near(sign > 0 ? left : right, sign > 0 ? 0 : viewport);
          } else near(shift, 0);
        }
      }
    }
  }
});
test('focal anchoring uses screen-point translation, not scale-multiplied translation', () => {
  const t = { scale: 2, x: 30, y: -20 };
  const from = point(210, 100); const to = point(230, 120);
  const q = point((from.x - 150 - t.x) / t.scale, (from.y - 150 - t.y) / t.scale);
  const next = zoomAt(geometry, t, 3, from, to);
  near(150 + next.x + q.x * next.scale, to.x);
  near(150 + next.y + q.y * next.scale, to.y);
  // Independent reference: translation must not be scaled by the transform order.
  near(next.x, 35); near(next.y, 15);
});
test('near-edge focal zoom is anchored where possible and bounded otherwise', () => {
  const next = zoomAt(geometry, fitTransform(), 2, point(5, 295));
  near(next.x, 145); near(next.y, -145);
  const bounded = zoomAt(geometry, next, 1, point(5, 295));
  assert.deepEqual(bounded, fitTransform());
  assert.equal(zoomAt(geometry, next, NaN, point(0, 0)), next);
});
test('4% cumulative mapping is neutral, symmetric and continuous at both thresholds', () => {
  for (const r of [1 / 1.04, 0.98, 1, 1.02, 1.04]) near(pinchRatio(r), 1);
  for (const r of [1.041, 1.1, 1.5, 2]) near(pinchRatio(r) * pinchRatio(1 / r), 1);
  near(pinchRatio(1.04 + 1e-9), 1, 1e-8);
  near(pinchRatio(1 / 1.04 - 1e-9), 1, 1e-8);
  assert.ok(pinchRatio(1.1) > pinchRatio(1.05));
  for (const r of [0, -1, NaN, Infinity]) assert.equal(pinchRatio(r), 1);
});
test('many tiny frames accumulate into a real pinch instead of remaining suppressed', () => {
  let state = beginTransform(enlarged(), 1, 'pinch', point(150, 150), 2, 1);
  for (let i = 1; i <= 100; i++) state = updateTransform(state, 1, 'pinch', point(150, 150), 2, 1 + i / 1000);
  near(state.transform.scale, 2 * 1.1 / 1.04);
  let pan = beginTransform(enlarged(), 1, 'pinch', point(100, 100), 2, 1);
  pan = updateTransform(pan, 1, 'pinch', point(120, 130), 2, 1.02);
  near(pan.transform.scale, 2); near(pan.transform.x, 20); near(pan.transform.y, 30);
});
test('single translation owner prevents duplicate movement during simultaneous callbacks', () => {
  let state = beginTransform(enlarged(), 1, 'pan', point(0, 0), 2);
  state = updateTransform(state, 1, 'pan', point(20, 10), 2);
  state = beginTransform(state, 1, 'pinch', point(160, 160), 2, 1);
  const before = state;
  assert.equal(updateTransform(state, 1, 'pan', point(90, 80), 2), state);
  assert.equal(endTransform(state, 1, 'pan'), state);
  state = updateTransform(state, 1, 'pinch', point(170, 180), 2, 1.01);
  near(state.transform.x, before.transform.x + 10); near(state.transform.y, before.transform.y + 20);
});
test('pan overshoot clamps, then reverses immediately by one point', () => {
  let state = beginTransform(enlarged(), 1, 'pan', point(0, 0), 2);
  state = updateTransform(state, 1, 'pan', point(1000, -1000), 2);
  assert.deepEqual(state.transform, { scale: 2, x: 150, y: -150 });
  state = updateTransform(state, 1, 'pan', point(999, -999), 2);
  assert.deepEqual(state.transform, { scale: 2, x: 149, y: -149 });
});
test('zoom limit reversal does not require repaying overshoot', () => {
  let state = beginTransform(enlarged(), 1, 'pinch', point(150, 150), 2, 1);
  state = updateTransform(state, 1, 'pinch', point(150, 150), 2, 4);
  assert.equal(state.transform.scale, 4);
  state = updateTransform(state, 1, 'pinch', point(150, 150), 2, 3.9);
  assert.ok(state.transform.scale < 4);
});
test('pointer-count transitions and explicit rebase retain transform without jumps', () => {
  let state = beginTransform(enlarged(), 1, 'pan', point(0, 0), 2);
  state = updateTransform(state, 1, 'pan', point(20, 20), 2);
  const t = state.transform;
  state = updateTransform(state, 1, 'pan', point(800, 900), 3);
  assert.deepEqual(state.transform, t);
  state = updateTransform(state, 1, 'pan', point(-900, -800), 2);
  assert.deepEqual(state.transform, t);
  state = updateTransform(state, 1, 'pan', point(0, 0), 1);
  state = updateTransform(state, 1, 'pan', point(9000, 9000), 2);
  assert.deepEqual(state.transform, t);
  state = rebaseTransform(state, 1, 'pan');
  state = updateTransform(state, 1, 'pan', point(-200, -200), 2);
  assert.deepEqual(state.transform, t);
});
test('finalize, restart and pinch-to-pan handoff have no initial transform jump', () => {
  let state = beginTransform(enlarged(), 1, 'pinch', point(150, 150), 2, 1);
  state = updateTransform(state, 1, 'pinch', point(160, 170), 2, 1.1);
  const t = state.transform;
  state = endTransform(state, 1, 'pinch');
  state = updateTransform(state, 1, 'pan', point(500, 500), 2);
  assert.deepEqual(state.transform, t);
  state = endTransform(state, 1, 'pan');
  state = beginTransform(state, 1, 'pinch', point(10, 10), 2, 2.5);
  state = updateTransform(state, 1, 'pinch', point(10, 10), 2, 2.5);
  assert.deepEqual(state.transform, t);
});
test('Fit is visually idempotent and invalidates active/stale operations', () => {
  let state = beginTransform(enlarged(), 1, 'pan', point(0, 0), 2);
  state = updateTransform(state, 1, 'pan', point(70, -90), 2);
  state = resetPreview(state, geometry, 'synthetic-a');
  assert.deepEqual(state.transform, fitTransform()); assert.equal(state.owner, null);
  assert.equal(updateTransform(state, 1, 'pan', point(500, 500), 2), state);
  assert.equal(beginTransform(state, 1, 'pinch', point(5, 5), 2), state);
  assert.equal(endTransform(state, 1, 'pan'), state);
  const again = resetPreview(state, geometry, 'synthetic-a');
  assert.deepEqual(again.transform, state.transform); assert.equal(again.generation, state.generation + 1);
});
test('new page, zero layout and orientation resets reject old gestures', () => {
  let state = enlarged(); const generation = state.generation;
  state = resetPreview(state, aspectFit(900, 1200, 300, 600), 'synthetic-b');
  assert.equal(state.pageKey, 'synthetic-b'); assert.deepEqual(state.transform, fitTransform());
  assert.equal(updateTransform(state, generation, 'pan', point(90, 0), 2), state);
  state = resetPreview(state, null, 'synthetic-b');
  assert.equal(beginTransform(state, state.generation, 'pan', point(0, 0), 2), state);
});
test('all transforms preserve frozen inputs', () => {
  const state = freeze(beginTransform(enlarged(), 1, 'pan', point(0, 0), 2));
  const before = JSON.stringify(state);
  const next = updateTransform(state, 1, 'pan', point(25, 25), 2);
  assert.notEqual(next, state); assert.equal(JSON.stringify(state), before);
  clampTransform(state.geometry, freeze({ scale: 8, x: 1e6, y: -1e6 }));
  resetPreview(state, state.geometry, 'other'); rebaseTransform(state, 1, 'pan');
  assert.equal(JSON.stringify(state), before);
});
test('installed worklet compiler transforms the exported pure helpers without native changes', () => {
  const fs = require('node:fs');
  const babel = require('@babel/core');
  const filename = require('node:path').resolve('src/core/capture/previewTransform.js');
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false, plugins: [require.resolve('react-native-worklets/plugin')],
  });
  assert.ok((result.code.match(/__workletHash/g) || []).length >= 10);
});

function evaluateAndroidWorklets(source, filename) {
  const vm = require('node:vm');
  const babel = require('@babel/core');
  const result = babel.transformSync(source, {
    filename, configFile: false, babelrc: false, presets: [require.resolve('babel-preset-expo')],
    caller: { name: 'metro', platform: 'android', engine: 'hermes', isDev: true, supportsStaticESM: true },
  });
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext('globalThis.global = globalThis', context);
  vm.runInContext(result.code, context);
  return { api: context.module.exports, context };
}
test('synthetic pan sampling executes under Expo Android compilation with no undefined closures', () => {
  const filename = require.resolve('../src/core/capture/syntheticPanDiagnostics');
  const { api } = evaluateAndroidWorklets(require('node:fs').readFileSync(filename, 'utf8'), filename);
  for (const fn of Object.values(api)) assert.ok(!Object.values(fn.__closure || {}).includes(undefined));
  const state = initial();
  const result = api.samplePanDiagnostic(api.newPanDiagnostic(), state, state, state.generation, 30, 0, 2);
  assert.equal(result.rawChanges, 1); assert.equal(result.appliedChanges, 0);
});
test('Android compiler captures forward worklet references before later helpers initialize', () => {
  const before = evaluateAndroidWorklets(`
    function first() { 'worklet'; return later(); }
    function later() { 'worklet'; return 42; }
    module.exports = { first, later };
  `, require.resolve('./previewTransform.test.js')).api;
  assert.ok(Object.values(before.first.__closure).includes(undefined));
  assert.throws(() => before.first(), /is not a function/);
  const after = evaluateAndroidWorklets(`
    function later() { 'worklet'; return 42; }
    function first() { 'worklet'; return later(); }
    module.exports = { first, later };
  `, require.resolve('./previewTransform.test.js')).api;
  assert.equal(after.first(), 42);
});
test('actual Android-compiled and serialized geometry closures execute pointer transitions safely', () => {
  const fs = require('node:fs'); const vm = require('node:vm');
  const filename = require('node:path').resolve('src/core/capture/previewTransform.js');
  const { api, context } = evaluateAndroidWorklets(fs.readFileSync(filename, 'utf8'), filename);
  for (const [name, fn] of Object.entries(api)) {
    if (typeof fn !== 'function') continue;
    assert.ok(!Object.values(fn.__closure || {}).includes(undefined), `${name} captured an undefined dependency`);
  }
  // Execute the serialized worklet bodies with recursively reconstructed closures,
  // not just the original CommonJS exports. This models capture semantics, not Hermes.
  const cache = new Map();
  function hydrate(value) {
    if (typeof value !== 'function') return value;
    if (cache.has(value)) return cache.get(value);
    assert.ok(value.__initData?.code, 'callable dependency must itself be a compiled worklet');
    const body = vm.runInContext(value.__initData.code, context);
    let closure;
    const callable = (...args) => body.apply({ __closure: closure }, args);
    cache.set(value, callable);
    closure = Array.isArray(value.__closure) ? value.__closure.map(hydrate) :
      Object.fromEntries(Object.entries(value.__closure || {}).map(([key, dependency]) => [key, hydrate(dependency)]));
    return callable;
  }
  const run = Object.fromEntries(Object.entries(api).map(([name, value]) => [name, hydrate(value)]));
  const g = run.aspectFit(1000, 1000, 300, 300);
  let state = run.resetPreview(null, g, 'synthetic');
  state = { ...state, transform: run.zoomAt(g, state.transform, 2, point(150, 150)) };
  state = run.beginTransform(state, state.generation, 'pan', point(0, 0), 2);
  state = run.updateTransform(state, state.generation, 'pan', point(20, 30), 2);
  near(state.transform.x, 20); near(state.transform.y, 30);
  state = run.updateTransform(state, state.generation, 'pan', point(100, 100), 1);
  assert.equal(state.cursor, null); // Previously called the captured undefined helper.
  state = run.updateTransform(state, state.generation, 'pan', point(900, 900), 2);
  near(state.transform.x, 20); near(state.transform.y, 30);
  state = run.endTransform(state, state.generation, 'pan');
  state = run.beginTransform(state, state.generation, 'pinch', point(150, 150), 2, 1);
  state = run.updateTransform(state, state.generation, 'pinch', point(150, 150), 2, 1.1);
  near(state.transform.scale, 2 * 1.1 / 1.04);
  const oldGeneration = state.generation;
  state = run.resetPreview(state, g, 'synthetic');
  assert.equal(run.updateTransform(state, oldGeneration, 'pan', point(99, 99), 2), state);
  near(state.transform.scale, 1); near(state.transform.x, 0); near(state.transform.y, 0);
  state = run.applyPreviewGeometry(state, run.aspectFit(900, 1200, 640, 300), 'portrait', 2, 'shape-button');
  state = { ...state, transform: run.zoomAt(state.geometry, state.transform, 4, point(320, 150)) };
  const snapshot = run.geometrySnapshot(state, 20);
  near(snapshot.limitX, 130); near(snapshot.limitY, 450);
  assert.equal(snapshot.sourceWidth, 900); assert.equal(snapshot.pageKey, 'portrait');
  assert.equal(snapshot.lastGeometryUpdateReason, 'shape-button');
  assert.equal(run.applyPreviewGeometry(state, geometry, 'stale', 1, 'old-layout'), state);
});
