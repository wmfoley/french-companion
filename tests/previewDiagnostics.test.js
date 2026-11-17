const test = require('node:test');
const assert = require('node:assert/strict');
const { createPreviewDiagnostics, summarizePreviewDiagnostics } = require('../src/core/capture/previewDiagnostics');

test('records ordered anonymous mode/action/native metrics with distinct origins', () => {
  let now = 100;
  const d = createPreviewDiagnostics(true, () => now);
  d.record('action_enlarge', 1, 'fit');
  now += 10;
  d.record('js_dimensions', 1, 'enlarge', { imageWidth: 3000 });
  d.record('scroll', 1, 'enlarge', { x: 900, viewportWidth: 640 });
  d.record('action_fit', 1, 'enlarge');
  d.record('image_layout', 1, 'fit', { imageWidth: 280 });
  const events = d.snapshot();
  assert.deepEqual(events.map(e => e.sequence), [1, 2, 3, 4, 5]);
  assert.equal(events[1].ms, 10);
  assert.equal(events[2].x, 900);
  assert.match(summarizePreviewDiagnostics(events), /JS:fit image_layout imageWidth=280/);
});

test('bounded defensive snapshots and summary survive repeated fit and per-page events', () => {
  const d = createPreviewDiagnostics(true, () => 0);
  for (let i = 0; i < 250; i++) d.record('action_fit', i % 3 + 1, 'enlarge');
  const events = d.snapshot();
  assert.equal(events.length, 200);
  assert.equal(events[0].sequence, 51);
  events[0].page = 999;
  assert.equal(d.snapshot()[0].page, 3);
  assert.equal(summarizePreviewDiagnostics(d.snapshot()).split('\n').filter(line => line.startsWith('#')).length, 40);
  d.clear();
  assert.deepEqual(d.snapshot(), []);
});

test('drops private fields, raw errors, invalid types and unsupported events', () => {
  const d = createPreviewDiagnostics(true, () => 0);
  const payload = Object.freeze({ uri: 'PRIVATE', text: 'PRIVATE', error: 'PRIVATE',
    source: { uri: 'PRIVATE' }, x: 'PRIVATE', imageWidth: Infinity, contentWidth: 600 });
  d.record('image_error', 1, 'fit', payload);
  d.record('PRIVATE', 1, 'fit', payload);
  d.record('scroll', -1, 'fit', payload);
  d.record('scroll', 1, 'PRIVATE', payload);
  assert.deepEqual(d.snapshot(), [{ sequence: 1, ms: 0, page: 1, jsMode: 'fit', kind: 'image_error', contentWidth: 600 }]);
  assert.doesNotMatch(JSON.stringify(d.snapshot()), /PRIVATE/);
});

test('disabled recorder is inert; diagnostic input cannot change preview data', () => {
  const disabled = createPreviewDiagnostics(false, () => 0);
  disabled.record('scroll', 1, 'fit', { x: 1 });
  assert.deepEqual(disabled.snapshot(), []);
  const page = Object.freeze({ imageWidth: 280, imageHeight: 380 });
  const d = createPreviewDiagnostics(true, () => 0);
  d.record('image_layout', 1, 'fit', page);
  assert.deepEqual(page, { imageWidth: 280, imageHeight: 380 });
});

test('summary separates absent or pre-Fit native samples from observed fitted bounds', () => {
  const d = createPreviewDiagnostics(true, () => 0);
  d.record('scroll', 1, 'enlarge', { x: 1000 });
  d.record('js_dimensions', 1, 'fit', { imageWidth: 280, imageHeight: 380 });
  assert.match(summarizePreviewDiagnostics(d.snapshot()), /No post-Fit native scroll sample/);
  const native = { x: 1000, y: 0, contentWidth: 280, contentHeight: 380, viewportWidth: 640, viewportHeight: 380 };
  d.record('scroll', 1, 'fit', native);
  assert.match(summarizePreviewDiagnostics(d.snapshot()), /outside reported bounds/);
  d.record('scroll', 1, 'fit', { ...native, x: 0 });
  assert.match(summarizePreviewDiagnostics(d.snapshot()), /within bounds; this does not prove image visibility/);
});
