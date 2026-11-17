const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/components/GestureRuntimeProof.js', 'utf8');
test('runtime probe uses installed gesture and UI worklet APIs with local containment', () => {
  for (const api of ['Gesture.Pinch()', 'Gesture.Pan()', 'Gesture.Simultaneous(pinch, pan)', 'GestureHandlerRootView', 'useSharedValue', 'useAnimatedStyle', "'worklet'", 'runOnJS(report)']) assert.ok(source.includes(api), api);
  assert.match(source, /minPointers\(2\)/);
  assert.match(source, /overflow: 'hidden'/);
  assert.match(source, /const gestures = useMemo/);
  assert.match(source, /if \(active.current\) \{\s+setMetrics/);
});
test('Gate 1A independently probes touch, JS recognition, UI execution and delivery', () => {
  for (const marker of ['Gate 1A diagnostic bundle v1', "onTouchStart={() => count('surface touch')}", 'Gesture.Tap().runOnJS(true)', "runOnJS(count)('pinch begin')", "runOnJS(count)('pan active')", 'runOnUI(() =>', "runOnJS(count)('button UI completed')", "count('UI reports')", 'Math.min(999']) assert.ok(source.includes(marker), marker);
  assert.doesNotMatch(source, /requestDisallowInterceptTouchEvent|unstable_forceActive|scrollEnabled=/);
});
test('probe is development-loaded and isolated from capture, images and persistence', () => {
  const parent = fs.readFileSync('src/components/CaptureProof.js', 'utf8');
  assert.match(parent, /__DEV__ \? require\('\.\/GestureRuntimeProof'\)/);
  assert.match(parent, /__DEV__ && GestureRuntimeProof && <GestureRuntimeProof parentScrollGesture=\{parentScrollGesture\} \/>/);
  assert.doesNotMatch(source, /expo-file-system|expo-camera|Image\b|console\.|fetch\(|AsyncStorage|SecureStore|SQLite/);
  assert.match(source, /Surrounding control check/);
});
test('Gate 1C coordinates the real local parent scroll without modifying shared Screen', () => {
  const parent = fs.readFileSync('src/components/CaptureProof.js', 'utf8');
  assert.match(parent, /parentScrollGesture = useMemo\(\(\) => Gesture.Native\(\), \[\]\)/);
  assert.match(parent, /<GestureDetector gesture=\{parentScrollGesture\}>\s*<ScrollView/);
  assert.match(parent, /<GestureHandlerRootView style=\{\{ flex: 1 \}\}>/);
  assert.equal((source.match(/blocksExternalGesture\(parentScrollGesture\)/g) || []).length, 2);
  assert.match(source, /averageTouches\(true\)/);
  assert.match(source, /beginTransform\(model.value, pinchGeneration.value, 'pinch'/);
  assert.match(source, /updateTransform\(before, panGeneration.value, 'pan'/);
  assert.match(source, /rebaseTransform\(model.value/);
  for (const body of source.matchAll(/\.onUpdate\(event => \{([\s\S]*?)\}\)/g)) {
    assert.doesNotMatch(body[1], /publish|runOnJS|setMetrics|setEvents/);
  }
  assert.match(source, /pan failed\/cancelled/);
  assert.match(source, /Gate 1C ownership retained/);
});
test('pan diagnostics distinguish raw motion, rejected ownership and applied targets without mutating model', () => {
  const { newPanDiagnostic, samplePanDiagnostic } = require('../src/core/capture/syntheticPanDiagnostics');
  const before = Object.freeze({ generation: 5, owner: 'pinch', cursor: Object.freeze({ pointers: 2 }), transform: Object.freeze({ x: 0, y: 0 }) });
  const initial = Object.freeze(newPanDiagnostic(10, 0, 2));
  const blocked = samplePanDiagnostic(initial, before, before, 5, 40, 0, 2);
  assert.equal(blocked.rawChanges, 1); assert.equal(blocked.pinchOwned, 1); assert.equal(blocked.appliedChanges, 0);
  const moving = { ...before, owner: 'pan' };
  const next = samplePanDiagnostic(blocked, moving, { ...moving, transform: { x: 30, y: 0 } }, 5, 70, 0, 2);
  assert.equal(next.appliedChanges, 1); assert.equal(next.rawChanges, 2); assert.equal(next.owner, 'pan');
  assert.equal(initial.updates, 0); assert.equal(before.transform.x, 0);
  const stale = samplePanDiagnostic(next, moving, moving, 4, 80, 0, 1);
  assert.equal(stale.stale, 1); assert.equal(stale.lowPointers, 1); assert.equal(stale.rebases, 1);
});
test('pan diagnostic output is bounded numeric metadata and excludes private payload fields', () => {
  const { newPanDiagnostic, samplePanDiagnostic } = require('../src/core/capture/syntheticPanDiagnostics');
  const state = { generation: 1, owner: 'PRIVATE', transform: { x: 0, y: 0 }, cursor: null, uri: 'PRIVATE', text: 'PRIVATE' };
  let d = newPanDiagnostic();
  for (let i = 0; i < 1100; i++) d = samplePanDiagnostic(d, state, state, 0, i, -i, 1);
  assert.equal(d.updates, 999); assert.equal(d.stale, 999); assert.equal(d.rebases, 999);
  assert.equal(d.owner, 'none'); assert.doesNotMatch(JSON.stringify(d), /PRIVATE|uri|text/);
  const bad = samplePanDiagnostic(d, state, state, 0, Infinity, NaN, undefined);
  assert.equal(bad.rawX, 0); assert.equal(bad.rawY, 0); assert.equal(bad.pointers, 0);
  assert.equal(bad.invalidInputs, 1);
});
test('Gate 2B.2 reports bounds and completion-only pan diagnostics without new gesture configuration', () => {
  assert.match(source, /Gate 2B\.2 pan diagnostics v1/);
  assert.match(source, /geometrySnapshot\(model.value, sampleSerial.value\)/);
  assert.match(source, /runOnJS\(reportPan\)\(panDiagnostic.value, model.value\)/);
  assert.match(source, /style target is not pixel evidence/);
});
test('Gate 2B synthetic model measures viewport, resets generations and never loads worksheet data', () => {
  for (const contract of ['aspectFit(page.width, page.height, viewport.width, viewport.height)', 'applyPreviewGeometry(model.value, geometry, key, request, reason)', 'pinchGeneration.set(model.value.generation)', 'panGeneration.set(model.value.generation)', "changeZoom('fit')", "changeZoom('in')", 'PREVIEW_LIMITS.zoomStep', 'onLayout=', 'Gate 2B geometry trial v1', 'AppState.addEventListener']) assert.ok(source.includes(contract), contract);
  assert.doesNotMatch(source, /result\.pages|\.uri|source=|takePicture|scanDocument/);
});
test('Gate 2B.3 displays one ordered snapshot rather than mixing current React shape with historic geometry', () => {
  assert.match(source, /Gate 2B\.3 geometry snapshot v1/);
  assert.match(source, /snapshot.serial > previous.serial/);
  assert.match(source, /formatGeometrySnapshot\(metrics\)/);
  assert.doesNotMatch(source, /\{page.key\}: scale|metrics\.bounds/);
  assert.match(source, /HISTORICAL last completed pan/);
  assert.match(source, /count\('shape button'\)/);
  assert.match(source, /Read current geometry snapshot/);
});
test('synthetic layout guard rejects stale page callbacks, invalid layout and older native timestamps', () => {
  const { acceptSyntheticLayout } = require('../src/core/capture/syntheticPanDiagnostics');
  const before = Object.freeze({ width: 640, height: 300, timestamp: 100 });
  assert.equal(acceptSyntheticLayout(before, 'square', 'portrait', 300, 640, 200), before);
  assert.equal(acceptSyntheticLayout(before, 'square', 'square', 300, 640, 50), before);
  assert.equal(acceptSyntheticLayout(before, 'square', 'square', 0, 300, 200), before);
  assert.deepEqual(acceptSyntheticLayout(before, 'square', 'square', 300, 640, 200), { width: 300, height: 640, timestamp: 200 });
  // Missing native timestamps are not evidence of old/new native ordering.
  assert.deepEqual(acceptSyntheticLayout(before, 'square', 'square', 600, 300, undefined), { width: 600, height: 300, timestamp: 100 });
});
