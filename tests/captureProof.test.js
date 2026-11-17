const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { proofAllowed, measurements, createOperationGuard, cleanupOwned } = require('../src/core/capture/captureProof');

test('proof requires explicit development Android and route checks before loading native code', () => {
  assert.equal(proofAllowed(true, 'android'), true);
  for (const [dev, platform] of [[false, 'android'], [true, 'web'], [true, 'ios'], [undefined, 'android']]) assert.equal(proofAllowed(dev, platform), false);
  const route = fs.readFileSync('app/capture-proof.js', 'utf8');
  assert.match(route, /if \(__DEV__ && Platform.OS === 'android'\)/);
  assert.ok(route.indexOf('if (__DEV__') < route.indexOf("require('../src/components/CaptureProof')"));
});
test('measurements preserve inputs and reject invalid dimensions or timing', () => {
  const pages = Object.freeze([Object.freeze({ width: 3000, height: 4000, bytes: 123, uri: 'file:///cache/a.jpg' })]);
  const result = measurements(10, 25, pages);
  assert.equal(result.elapsedMs, 15); assert.equal(result.pageCount, 1);
  assert.notEqual(result.pages[0], pages[0]);
  assert.throws(() => measurements(20, 10, pages));
  assert.throws(() => measurements(0, 1, [{ width: 0, height: 1, bytes: 1 }]));
});
test('navigation invalidates deferred result but preserves mutex until native completion', async () => {
  const guard = createOperationGuard(); guard.enter();
  const token = guard.begin(); assert.notEqual(token, null); assert.equal(guard.begin(), null);
  let resolve; const deferred = new Promise(done => { resolve = done; });
  const operation = deferred.then(() => { const deliver = guard.current(token); guard.finish(); return deliver; });
  guard.leave(); guard.enter(); assert.equal(guard.begin(), null);
  resolve(); assert.equal(await operation, false);
  const next = guard.begin(); assert.notEqual(next, null); assert.equal(guard.current(next), true);
  guard.finish();
});
test('cleanup only deletes direct proof-owned files and retries failures', async () => {
  const root = 'file:///cache/fc-capture-proof'; let deletes = 0;
  const file = { uri: `${root}/one.jpg`, exists: true, delete: () => { deletes++; } };
  await cleanupOwned([file], root); assert.equal(deletes, 1);
  for (const uri of ['file:///cache/other.jpg', `${root}/../other.jpg`, `${root}/nested/one.jpg`]) {
    await assert.rejects(cleanupOwned([file, { ...file, uri }], root));
  }
  assert.equal(deletes, 1);
  await assert.rejects(cleanupOwned([{ ...file, delete: () => { throw new Error('disk'); } }], root));
  await cleanupOwned([file], root); assert.equal(deletes, 2);
});
