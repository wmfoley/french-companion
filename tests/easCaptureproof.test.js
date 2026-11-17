/* global __dirname */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Existing ESLint dependency; evaluate real gitignore-style upload rules.
const ignore = require('ignore');
const root = path.join(__dirname, '..');
const eas = require('../eas.json');
const configure = require('../app.config');
const base = require('../app.json').expo;
const excluded = ignore().add(fs.readFileSync(path.join(root, '.easignore'), 'utf8'));

test('upload rules satisfy EAS CLI exact .git check and exclude all Git contents', () => {
  // EAS CLI GitClient.makeShallowCopyAsync checks ignores('.git'), without a slash.
  assert.equal(ignore().add('.git/').ignores('.git'), false);
  for (const file of ['.git', '.git/', '.git/config', '.git/logs/HEAD',
    '.git/objects/pack/history.pack', '.git/refs/heads/main']) {
    assert.equal(excluded.ignores(file), true, file);
  }
});

test('captureproof EAS profile pins the documented SDK 58 Linux image and isolated identity', () => {
  assert.deepEqual(eas.build.captureproof, {
    developmentClient: true, distribution: 'internal', environment: 'development',
    env: { APP_VARIANT: 'captureproof' },
    android: { buildType: 'apk', image: 'ubuntu-26.04-jdk-17-ndk-r27b-sdk-58' },
  });
  const previous = process.env.APP_VARIANT;
  try {
    process.env.APP_VARIANT = eas.build.captureproof.env.APP_VARIANT;
    const config = configure({ config: base });
    assert.equal(config.android.package, 'com.frenchcompanion.captureproof');
    assert.equal(config.name, 'French Companion Capture Proof');
    assert.equal(config.scheme, 'french-companion-captureproof');
    assert.deepEqual(config.extra.eas, { projectId: '0234dc22-4a9d-4bc3-b515-769a186c2acb' });
    assert.equal(config.owner, 'wmtfoley');
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
});

test('existing EAS profiles and working-tree policy remain unchanged', () => {
  const existing = structuredClone(eas.build);
  delete existing.captureproof;
  assert.deepEqual(existing, { development: {
    developmentClient: true, distribution: 'internal',
    env: { APP_VARIANT: 'development' }, android: { buildType: 'apk' },
  } });
  assert.deepEqual(eas.cli, { requireCommit: false });
});

test('upload rules exclude native outputs, private state, diagnostics, archives and signing material', () => {
  for (const file of [
    'android/app/build.gradle', 'ios/Podfile', 'node_modules/example/index.js',
    '.expo/fc007b-cpp-driver.init.gradle', '.expo/checkpoints/snapshot.zip',
    '.expo/browser-profile/Default/IndexedDB/state', '.aws/credentials', '.codex/settings.json',
    'modules/fc-native-pbkdf2/android/build/classes.dex',
    'modules/fc-native-pbkdf2/android/.cxx/cache.txt',
    'modules/fc-native-pbkdf2/android/.gradle/state',
    '.env', '.env.development.local', 'local/household.db', 'local/household.db-wal',
    'local/household.sqlite', 'local/household.sqlite-shm', 'local/household.sqlite3',
    'build.log', 'heap.hprof', 'recording.jfr', 'cpu.cpuprofile', 'heap.heapprofile',
    'runtime.trace', 'backup.zip', 'backup.tar', 'backup.tar.gz', 'backup.tgz',
    'eas-archive/src/index.js', 'credentials.json', 'signing.jks', 'debug.keystore',
    'key.pem', 'key.p12', 'key.pfx', 'private.key', 'android/local.properties',
    'proof.apk', 'proof.aab', 'dist/index.html',
  ]) assert.equal(excluded.ignores(file), true, file);
});

test('upload rules preserve required local native source, registration, assets and proof source', () => {
  for (const file of [
    'modules/fc-native-pbkdf2/package.json', 'modules/fc-native-pbkdf2/expo-module.config.json',
    'modules/fc-native-pbkdf2/android/build.gradle',
    'modules/fc-native-pbkdf2/android/src/main/AndroidManifest.xml',
    'modules/fc-native-pbkdf2/android/src/main/java/expo/modules/fcpbkdf2/FcNativePbkdf2Module.kt',
    'modules/fc-native-pbkdf2/android/src/main/assets/fc-pbkdf2-vectors.json',
    'app/capture-proof.js', 'src/components/CaptureProof.js', 'src/core/capture/captureProof.js',
    'app.config.js', 'app.json', 'package.json', 'package-lock.json', 'eas.json',
  ]) {
    assert.equal(excluded.ignores(file), false, file);
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
  for (const file of ['assets/icon.png', 'assets/worksheet.jpg', '.env.example']) {
    assert.equal(excluded.ignores(file), false, file);
  }
});
