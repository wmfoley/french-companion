const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validPreviewPage, selectPreviewPage, createImagePreviewLifecycle } = require('../src/core/capture/capturePreview');
const { aspectFit, resetPreview, zoomAt, applyPreviewGeometry, beginTransform, updateTransform } = require('../src/core/capture/previewTransform');
const source = fs.readFileSync('src/components/CaptureImagePreview.js', 'utf8');
const parent = fs.readFileSync('src/components/CaptureProof.js', 'utf8');
const lifecycle = overrides => createImagePreviewLifecycle({ imageIdentity: 'local-image-1', method: 'scanner', pageNumber: 1, width: 900, height: 1200, ...overrides });

test('viewer accepts supplied local file/source dimensions, not network URLs or display guesses', () => {
  assert.equal(validPreviewPage(Object.freeze({ uri: 'file:///PRIVATE', width: 900, height: 1200 })), true);
  for (const uri of ['https://example.com/a.jpg', 'data:image/jpeg;base64,AAAA', null]) assert.equal(validPreviewPage({ uri, width: 900, height: 1200 }), false);
  for (const width of [0, -1, NaN, Infinity, undefined]) assert.equal(validPreviewPage({ uri: 'file:///PRIVATE', width, height: 1200 }), false);
  assert.match(source, /aspectFit\(page.width, page.height, viewport.width, viewport.height\)/);
});
test('frozen pages keep identity/order and new results reset selection without mutating either capture', () => {
  const pages = Object.freeze([Object.freeze({ uri: 'file:///one' }), Object.freeze({ uri: 'file:///two' }), Object.freeze({ uri: 'file:///three' })]);
  let selection = selectPreviewPage(null, pages);
  assert.equal(selection.index, 0);
  for (let i = 0; i < 10; i++) selection = selectPreviewPage(selection, pages, 1);
  assert.equal(selection.index, 2); assert.equal(selection.pages[2], pages[2]);
  selection = selectPreviewPage(selection, pages, -1); assert.equal(selection.index, 1);
  const newer = Object.freeze([Object.freeze({ uri: 'file:///new' })]);
  assert.equal(selectPreviewPage(selection, newer).index, 0);
  assert.deepEqual(pages.map(p => p.uri), ['file:///one', 'file:///two', 'file:///three']);
  assert.equal(selectPreviewPage(null, []).index, 0);
  assert.throws(() => selectPreviewPage(selection, pages, NaN));
});
test('image success and failure are explicit, retry rejects previous same-URI load callbacks', () => {
  const life = lifecycle(); const first = life.token();
  assert.equal(life.start(first), true); assert.equal(life.snapshot().loadStarts, 1);
  assert.equal(life.snapshot().status, 'loading');
  assert.equal(life.load(first, 'error'), true); assert.equal(life.snapshot().status, 'error');
  const second = life.retry();
  assert.notEqual(second.epoch, first.epoch);
  assert.equal(life.load(first, 'success', 1, 1), false);
  assert.equal(life.start(first), false);
  assert.equal(life.snapshot().status, 'loading');
  assert.equal(life.load(second, 'success', 900, 1200), true);
  const snapshot = life.snapshot();
  assert.equal(snapshot.status, 'loaded'); assert.equal(snapshot.stale, 2);
  assert.equal(snapshot.sourceWidth, 900); assert.equal(snapshot.decodedWidth, 900);
});
test('old-page load/layout callbacks cannot update a new page; strict lifecycle reentry is safe', () => {
  const old = lifecycle(); const token = old.token(); old.close();
  const next = lifecycle({ imageIdentity: 'local-image-2', width: 1200, height: 900 });
  assert.equal(old.load(token, 'success'), false); assert.equal(old.layout(100), false);
  assert.equal(next.snapshot().status, 'loading'); assert.equal(next.snapshot().sourceWidth, 1200);
  const again = old.open(); assert.notEqual(again.epoch, token.epoch);
  assert.equal(old.load(token, 'success'), false);
  assert.equal(old.load(again, 'success'), true);
  assert.equal(old.snapshot().mounts, 2); assert.equal(old.snapshot().unmounts, 1);
});
test('layout rejects old native timestamps; absent timestamps remain explicitly unordered', () => {
  const life = lifecycle();
  assert.equal(life.layout(200), true); assert.equal(life.layout(100), false);
  assert.equal(life.layout(undefined), true); assert.equal(life.snapshot().stale, 1);
});
test('diagnostics retain bounded anonymous load/mount data, with no raw URI/error payload', () => {
  const life = lifecycle({ imageIdentity: 'file:///PRIVATE', method: 'PRIVATE', width: 'PRIVATE' });
  for (let i = 0; i < 1100; i++) life.load({ epoch: -1 }, 'PRIVATE');
  const snapshot = life.snapshot();
  assert.equal(snapshot.events.length, 40); assert.equal(snapshot.stale, 999);
  assert.equal(snapshot.imageIdentity, 'local-image'); assert.equal(snapshot.method, 'unknown');
  assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE|file:\/\//);
  snapshot.events[0].kind = 'changed';
  assert.notEqual(life.snapshot().events[0].kind, 'changed');
});
test('viewer controls use approved bounds; repeated Fit and viewport/background resets reject old gestures', () => {
  for (const [w, h] of [[900, 1200], [1200, 900]]) {
    let s = applyPreviewGeometry(resetPreview(null, null, 'local-image-1'), aspectFit(w, h, 640, 380), 'local-image-1', 1, 'page-layout');
    for (let i = 0; i < 20; i++) s = { ...s, transform: zoomAt(s.geometry, s.transform, s.transform.scale * 1.25, { x: 320, y: 190 }) };
    assert.equal(s.transform.scale, 4);
    for (let i = 0; i < 20; i++) s = { ...s, transform: zoomAt(s.geometry, s.transform, s.transform.scale / 1.25, { x: 320, y: 190 }) };
    assert.equal(s.transform.scale, 1);
    const generation = s.generation;
    s = beginTransform(s, generation, 'pan', { x: 0, y: 0 }, 2);
    for (const reason of ['fit-button', 'fit-button', 'background', 'resume']) {
      s = resetPreview(s, s.geometry, s.pageKey, reason);
      assert.equal(updateTransform(s, generation, 'pan', { x: 100, y: 100 }, 2), s);
      assert.deepEqual(s.transform, { scale: 1, x: 0, y: 0 });
    }
    s = applyPreviewGeometry(s, aspectFit(w, h, 380, 640), s.pageKey, 2, 'viewport-orientation');
    assert.deepEqual(s.transform, { scale: 1, x: 0, y: 0 });
  }
});
test('real viewer uses accepted gesture helpers, ownership and UI-only per-frame updates', () => {
  for (const contract of ['Gesture.Simultaneous(pinch, pan)', 'minPointers(2).averageTouches(true)', 'beginTransform(', 'updateTransform(', 'rebaseTransform(', 'endTransform(', 'applyPreviewGeometry(', 'geometrySnapshot(']) assert.ok(source.includes(contract), contract);
  assert.equal((source.match(/blocksExternalGesture\(parentScrollGesture\)/g) || []).length, 2);
  for (const body of source.matchAll(/\.onUpdate\(event => \{([\s\S]*?)\}\)/g)) assert.doesNotMatch(body[1], /runOnJS|setStatus|setSnapshot/);
  assert.match(source, /useWindowDimensions/); assert.match(source, /state === 'active' \? 'resume' : 'background'/);
});
test('image identity remains mounted through gestures/Fit and changes only for page or explicit retry', () => {
  assert.match(source, /<PreviewSession key=\{props.page.uri\}/);
  assert.match(source, /<Image key=\{request.epoch\} source=\{source\}/);
  assert.match(source, /useMemo\(\(\) => \(\{ uri: page.uri \}\), \[page.uri\]\)/);
  assert.doesNotMatch(source, /key=\{(?:model|snapshot|status)/);
  assert.match(source, /lifecycle.load\(request, 'success'/); assert.match(source, /lifecycle.load\(request, 'error'/);
  assert.match(source, /onLoadStart=\{started\}/);
});
test('proof keeps original ScrollView fallback, both capture sources and nonmutating active-page navigation', () => {
  assert.match(parent, /useState\('original'\)/);
  assert.match(parent, /Original ScrollView Preview/); assert.match(parent, /New Gesture Preview/);
  assert.match(parent, /result.pages.map\(\(page, index\) => <View key=\{page.uri\}>/);
  assert.match(parent, /style=\{\{ width: zoom \? page.width : 280, height: zoom \? page.height : 380 \}\}/);
  assert.match(parent, /page=\{result.pages\[selected.index\]\}/);
  assert.match(parent, /captureMethod=\{result.kind\}/);
  assert.match(parent, /selectPreviewPage\(previous, result.pages, -1\)/);
  assert.match(parent, /selectPreviewPage\(previous, result.pages, 1\)/);
  assert.match(parent, /slice\(-10\)/);
});
test('viewer is development-only, has no cleanup/storage/capture commands or private-path logging', () => {
  assert.match(source, /if \(!__DEV__\) return null/);
  assert.match(parent, /__DEV__ \? require\('\.\/CaptureImagePreview'\)/);
  assert.doesNotMatch(source, /expo-file-system|expo-camera|\.delete\(|\.move\(|\.copy\(|console\.|fetch\(|scanDocument|takePicture|SecureStore|SQLite/);
  assert.doesNotMatch(source, /onDiagnostic\?\.\(.*(?:page.uri|source\.uri)/);
  assert.match(source, /accessibilityLabel=\{`Captured worksheet page/);
  assert.match(source, /Retry image load/);
});
test('Expo Android preset compiles viewer worklets using existing installed tooling', () => {
  const result = require('@babel/core').transformSync(source, {
    filename: require.resolve('../src/components/CaptureImagePreview'), configFile: false, babelrc: false,
    presets: [require.resolve('babel-preset-expo')],
    caller: { name: 'metro', platform: 'android', engine: 'hermes', isDev: true, supportsStaticESM: true },
  });
  assert.ok((result.code.match(/__workletHash/g) || []).length >= 10);
});
