const test = require('node:test');
const assert = require('node:assert/strict');
const { createHouseholdService } = require('../src/services/householdService');
const { createParentOperations } = require('../src/services/parent/parentOperations');
const { createSetupDiagnostics } = require('../src/services/parent/setupDiagnostics');
const { createPinCredential } = require('../src/services/parent/pinCredential');
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('setup guard survives leave during derivation, cancellation prevents writes, and retry waits for settlement', async () => {
  const derivation = deferred(); let writes = 0;
  const service = createHouseholdService({ credential: { create: () => derivation.promise },
    store: { update: async mutate => { mutate(null); writes++; } } });
  const setup = service.setup('123456', '123456');
  service.lock();
  await assert.rejects(service.setup('123456', '123456'), /still running/);
  derivation.resolve({});
  await assert.rejects(setup, /cancelled/); assert.equal(writes, 0);
  await service.setup('123456', '123456'); assert.equal(writes, 1);
});

test('rejection releases setup guard; unresolved persistence does not', async () => {
  const persistence = deferred(); const entered = deferred(); let failing = true;
  const service = createHouseholdService({ credential: { create: async () => { if (failing) throw Error('derive failed'); return {}; } },
    store: { update: async mutate => { mutate(null); entered.resolve(); await persistence.promise; } } });
  await assert.rejects(service.setup('123456', '123456'), /derive failed/);
  failing = false;
  const setup = service.setup('123456', '123456'); await entered.promise; service.lock();
  await assert.rejects(service.setup('123456', '123456'), /still running/);
  persistence.resolve(); await setup;
  await assert.rejects(service.getParentPolicy({}), /locked/);
});

test('focus and operation identity suppress late success, failure and finally after re-entry', async () => {
  const operations = createParentOperations(); const oldFocus = operations.enter(); const old = operations.begin();
  assert.equal(operations.begin(), null);
  operations.leave(); const newFocus = operations.enter(); const next = operations.begin();
  assert.equal(operations.isFocus(oldFocus), false); assert.equal(operations.isFocus(newFocus), true);
  assert.equal(operations.isCurrent(old), false); assert.equal(operations.finish(old), false);
  assert.equal(operations.isCurrent(next), true); assert.equal(operations.finish(next), true);
  const background = operations.begin(); operations.invalidate();
  assert.equal(operations.isCurrent(background), false); assert.equal(operations.finish(background), false);
  assert.ok(operations.begin());
});

test('diagnostics are bounded, sanitized, timed and never settle the underlying task', async () => {
  let time = 0; const events = []; const timers = []; const cleared = [];
  const diagnostics = createSetupDiagnostics({ enabled: true, now: () => time, emit: event => events.push(event),
    schedule: (action, delay) => { timers.push({ action, delay }); return timers.length; }, cancel: id => cleared.push(id) });
  const trace = diagnostics.start(); const pending = deferred(); let settled = false;
  const task = trace.span('pbkdf2', () => pending.promise).finally(() => { settled = true; });
  for (const timer of timers) { time = timer.delay; timer.action(); }
  assert.equal(settled, false); assert.equal(events.filter(e => e.event === 'slow').length, 3);
  assert.equal(events.at(-1).stage, 'pbkdf2');
  pending.reject(Error('SECRET-PIN-SALT-VERIFIER'));
  await assert.rejects(task); trace.finish('derivation'); trace.finish('credential');
  assert.equal(cleared.length, 3);
  assert.ok(!JSON.stringify(events).includes('SECRET'));
  assert.equal(events.at(-1).category, 'derivation');
  assert.equal(events.at(-1).durationMs, 60000);
});

test('production diagnostics emit nothing and schedule no timers; observers cannot break setup', async () => {
  const diagnostics = createSetupDiagnostics({ emit: () => { throw Error('must not run'); }, schedule: () => { throw Error('must not run'); } });
  const trace = diagnostics.start(); assert.equal(await trace.span('pbkdf2', async () => 7), 7); trace.finish();
  const enabled = createSetupDiagnostics({ enabled: true, emit: () => { throw Error('observer failed'); }, schedule: () => 0, cancel() {} }).start();
  assert.equal(await enabled.span('pbkdf2', async () => 8), 8); enabled.finish();
});

test('diagnostic buffer and emissions are capped and subscriptions are removable', async () => {
  let emissions = 0; let notifications = 0;
  const diagnostics = createSetupDiagnostics({ enabled: true, emit: () => { emissions++; }, schedule: () => 0, cancel() {} });
  const unsubscribe = diagnostics.subscribe(() => { notifications++; });
  const trace = diagnostics.start();
  for (let i = 0; i < 40; i++) await trace.span('pbkdf2', async () => {});
  assert.equal(emissions, 48); assert.equal(diagnostics.snapshot().length, 32);
  unsubscribe(); const old = notifications; diagnostics.start().finish(); assert.equal(notifications, old);
});

test('credential creation traces randomness and derivation without changing parameters or values', async () => {
  const stages = []; let iterations;
  const credential = createPinCredential(null, { randomBytes: async n => new Uint8Array(n), derive: async (pin, salt, c) => { iterations = c; return new Uint8Array(32); } });
  const result = await credential.create('123456', { span: async (stage, action) => { stages.push(stage); return action(); } });
  assert.deepEqual(stages, ['randomness', 'pbkdf2']); assert.equal(iterations, 600000); assert.equal(credential.valid(result), true);
});
