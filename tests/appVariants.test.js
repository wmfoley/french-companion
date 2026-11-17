const test = require('node:test');
const assert = require('node:assert/strict');
const configure = require('../app.config');
const base = require('../app.json').expo;

function variant(value, config = base) {
  const previous = process.env.APP_VARIANT;
  try {
    if (value === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = value;
    return configure({ config });
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}
test('default/production/unknown variants preserve base configuration exactly', () => {
  for (const value of [undefined, 'production', 'unknown']) assert.equal(variant(value), base);
});
test('development retains its accepted identity and secure-store plugin', () => {
  const result = variant('development');
  assert.equal(result.name, 'French Companion Dev');
  assert.equal(result.scheme, 'french-companion-dev');
  assert.equal(result.android.package, 'com.frenchcompanion.dev');
  assert.equal(result.android.blockedPermissions, undefined);
  assert.ok(result.plugins.includes('expo-secure-store'));
  assert.deepEqual(result.plugins.find(p => Array.isArray(p) && p[0] === 'expo-camera'), ['expo-camera', { recordAudioAndroid: false }]);
});
test('captureproof is isolated without mutating source config or dev-client duplication', () => {
  const config = structuredClone(base);
  config.android = { package: 'example.base', allowBackup: false };
  config.plugins.push(['expo-dev-client', { addGeneratedScheme: true }]);
  const before = structuredClone(config);
  const result = variant('captureproof', config);
  assert.equal(result.android.package, 'com.frenchcompanion.captureproof');
  assert.equal(result.android.allowBackup, false);
  assert.deepEqual(result.android.blockedPermissions, ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']);
  assert.equal(result.name, 'French Companion Capture Proof');
  assert.equal(result.scheme, 'french-companion-captureproof');
  assert.deepEqual(result.plugins.filter(p => Array.isArray(p) && p[0] === 'expo-dev-client'), [['expo-dev-client', { addGeneratedScheme: false }]]);
  assert.ok(result.plugins.includes('expo-secure-store'));
  assert.deepEqual(result.plugins.find(p => Array.isArray(p) && p[0] === 'expo-camera'), ['expo-camera', { recordAudioAndroid: false }]);
  assert.deepEqual(config, before);
});
test('captureproof preserves existing exclusions without leaking them to other variants', () => {
  const config = structuredClone(base);
  config.android = { blockedPermissions: ['example.existing', 'android.permission.READ_EXTERNAL_STORAGE'] };
  const original = structuredClone(config);
  assert.deepEqual(variant('captureproof', config).android.blockedPermissions,
    ['example.existing', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']);
  assert.deepEqual(variant('development', config).android.blockedPermissions, original.android.blockedPermissions);
  assert.deepEqual(variant('production', config), original);
  assert.deepEqual(config, original);
});
