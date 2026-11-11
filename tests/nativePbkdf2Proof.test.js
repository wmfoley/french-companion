const test = require('node:test');
const assert = require('node:assert/strict');
const { pbkdf2Sync, webcrypto } = require('node:crypto');
const { Buffer } = require('node:buffer');
const { spawnSync } = require('node:child_process');
const { createPbkdf2Proof, vectorIds } = require('../src/services/development/pbkdf2Proof');
const fixture = require('../modules/fc-native-pbkdf2/android/src/main/assets/fc-pbkdf2-vectors.json');
const baseConfig = require('../app.json').expo;
const configure = require('../app.config');

test('public full-parameter vectors match independent Node crypto and WebCrypto', async () => {
  assert.equal(fixture.iterations, 600000); assert.equal(fixture.saltBytes, 16); assert.equal(fixture.verifierBytes, 32);
  assert.deepEqual(fixture.vectors.map(vector => vector.id), vectorIds);
  for (const vector of fixture.vectors) {
    const salt = Buffer.from(vector.saltHex, 'hex'); assert.equal(salt.length, 16);
    assert.match(vector.password, /^[0-9]{6}$/);
    const expected = pbkdf2Sync(vector.password, salt, fixture.iterations, 32, 'sha256');
    assert.equal(expected.toString('hex'), vector.expectedHex);
    const key = await webcrypto.subtle.importKey('raw', Buffer.from(vector.password), 'PBKDF2', false, ['deriveBits']);
    const actual = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: fixture.iterations }, key, 256);
    assert.deepEqual(Buffer.from(actual), expected);
  }
});

test('web/production never load the module; Expo Go missing-module errors stay safe', async () => {
  for (const [development, platform] of [[false, 'android'], [true, 'web'], [true, 'ios']]) {
    const proof = createPbkdf2Proof({ development, platform, loadModule: () => { throw Error('must not load'); } });
    assert.equal(proof.available(), false); await assert.rejects(proof.run('digits'), /unavailable/);
  }
  const missing = createPbkdf2Proof({ development: true, platform: 'android', loadModule: () => null });
  assert.equal(missing.available(), false); await assert.rejects(missing.run('digits'), /Expo Go/);
});

test('proof holds concurrency guard until actual settlement and returns only whitelisted metadata', async () => {
  let release; let time = 0;
  const proof = createPbkdf2Proof({ development: true, platform: 'android', now: () => time,
    loadModule: () => ({ runProof: () => new Promise(resolve => { release = resolve; }) }) });
  assert.equal(proof.available(), true);
  const pending = proof.run('digits');
  await assert.rejects(proof.run('digits'), /still running/);
  time = 100;
  release({ vectorId: 'digits', passed: true, derivationMs: 90, offMainThread: true, androidApi: 31, secret: 'not-forwarded' });
  assert.deepEqual(await pending, { vectorId: 'digits', passed: true, derivationMs: 90, offMainThread: true, androidApi: 31, roundTripMs: 100 });
  await assert.rejects(proof.run('unknown'), /Unknown/);
});

test('native mismatch stays visible, malformed metadata is rejected, and failures permit retry', async () => {
  let result = { vectorId: 'digits', passed: false, derivationMs: 10, offMainThread: true, androidApi: 31 };
  let fail = false;
  const proof = createPbkdf2Proof({ development: true, platform: 'android', loadModule: () => ({ runProof: async () => { if (fail) throw Error('SENSITIVE'); return result; } }) });
  assert.equal((await proof.run('digits')).passed, false);
  for (const changed of [{ offMainThread: false }, { androidApi: 25 }, { derivationMs: NaN }, { vectorId: 'other' }, { passed: 'yes' }]) {
    const original = result; result = { ...result, ...changed }; await assert.rejects(proof.run('digits'), /invalid result/); result = original;
  }
  fail = true; await assert.rejects(proof.run('digits'), error => !error.message.includes('SENSITIVE'));
  fail = false; assert.equal((await proof.run('digits')).passed, false);
});

test('development identity is explicit; default web/Expo Go config and slug are preserved', () => {
  const previous = process.env.APP_VARIANT;
  try {
    delete process.env.APP_VARIANT;
    assert.deepEqual(configure({ config: baseConfig }), baseConfig);
    process.env.APP_VARIANT = 'development';
    const development = configure({ config: baseConfig });
    assert.equal(development.name, 'French Companion Dev'); assert.equal(development.android.package, 'com.frenchcompanion.dev');
    assert.equal(development.scheme, 'french-companion-dev'); assert.equal(development.slug, baseConfig.slug);
    assert.deepEqual(development.web, baseConfig.web);
    const eas = require('../eas.json');
    assert.equal(eas.build.development.developmentClient, true);
    assert.equal(eas.build.development.distribution, 'internal');
    assert.equal(eas.build.development.env.APP_VARIANT, 'development');
    assert.equal(eas.build.development.android.buildType, 'apk');
    assert.equal(eas.cli.requireCommit, false);
  } finally { if (previous === undefined) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = previous; }
});

test('upload ignore rules preserve local native source but exclude checkpoints and generated projects', () => {
  const check = file => spawnSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`,
    '-c', 'core.excludesfile=.easignore', 'check-ignore', '--no-index', '-q', file], { encoding: 'utf8' });
  for (const file of ['modules/fc-native-pbkdf2/android/build.gradle',
    'modules/fc-native-pbkdf2/android/src/main/java/expo/modules/fcpbkdf2/FcNativePbkdf2Module.kt',
    'modules/fc-native-pbkdf2/android/src/main/assets/fc-pbkdf2-vectors.json']) {
    assert.equal(check(file).status, 1, `Native source must remain uploadable: ${file}`);
  }
  for (const file of ['.expo/checkpoints/example/worktree.zip', 'android/app/build.gradle', '.env.local', 'credentials.json']) {
    assert.equal(check(file).status, 0, `Local/generated data must remain excluded: ${file}`);
  }
});
