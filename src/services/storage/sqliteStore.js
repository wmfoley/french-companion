const CREDENTIAL_KEY = 'french-companion.parent-credential.v1';
const LOCKED = 'Stored parent credentials are unavailable or inconsistent. Household data has been kept. Parent access and practice remain locked; do not reset the PIN.';

/** Native serialization facade: same in-memory envelope as web; verifier never enters SQLite. */
function createSqliteStore({ openDatabase, secureStore, randomId, validCredential }) {
  let opening;
  let queue = Promise.resolve();
  const copy = value => JSON.parse(JSON.stringify(value));
  function serialized(action, trace) {
    const previous = queue;
    const waiting = trace ? trace.span('storage_queue', () => previous) : previous;
    const result = waiting.then(action);
    queue = result.catch(() => {});
    return result;
  }
  async function open() {
    if (!opening) opening = (async () => {
      const db = await openDatabase();
      await db.execAsync('CREATE TABLE IF NOT EXISTS installation (id INTEGER PRIMARY KEY CHECK (id = 1), phase TEXT NOT NULL, payload TEXT NOT NULL)');
      return db;
    })().catch(error => { opening = null; throw error; });
    return opening;
  }
  function decode(row) {
    try {
      const data = JSON.parse(row.payload);
      if (data.nativeStorageVersion !== 1 || typeof data.credentialId !== 'string' || !data.credentialId || !data.state?.household ||
        Object.hasOwn(data.state.household, 'credential') || !['pending', 'ready'].includes(row.phase)) throw Error();
      return data;
    } catch { throw new Error(LOCKED); }
  }
  async function credentialFor(id) {
    try {
      const saved = JSON.parse(await secureStore.getItemAsync(CREDENTIAL_KEY));
      if (!saved || saved.id !== id || !validCredential(saved.record)) throw Error();
      return saved.record;
    } catch { throw new Error(LOCKED); }
  }
  async function readInTransaction(tx, trace) {
    const span = (stage, action) => trace ? trace.span(stage, action) : action();
    const row = await tx.getFirstAsync('SELECT phase, payload FROM installation WHERE id = 1');
    if (!row) {
      // A surviving credential is not permission to start over with existing/unknown data.
      try { if (await span('secure_read', () => secureStore.getItemAsync(CREDENTIAL_KEY)) !== null) throw Error(); }
      catch { throw new Error(LOCKED); }
      return null;
    }
    const data = decode(row);
    const record = await span('secure_read', () => credentialFor(data.credentialId));
    if (row.phase === 'pending') {
      const state = data.state;
      if (state.storageVersion !== 1 || state.household.policy?.practiceMode !== 'require_parent_approval' ||
        state.household.policy?.revision !== 1 || state.assignments?.length !== 0) throw new Error(LOCKED);
      // Resume only the same already-written credential and initial strict empty installation.
      await tx.runAsync("UPDATE installation SET phase = 'ready' WHERE id = 1");
    }
    data.state.household.credential = record;
    return { state: data.state, credentialId: data.credentialId };
  }
  async function read() {
    return serialized(async () => {
      const db = await open();
      let result;
      await db.withExclusiveTransactionAsync(async tx => { const data = await readInTransaction(tx); result = data ? data.state : null; });
      return result;
    });
  }
  async function update(mutate, { trace, beforeInitialize } = {}) {
    const span = (stage, action) => trace ? trace.span(stage, action) : action();
    return serialized(async () => {
      const db = await span('sqlite_init', open);
      let result;
      let initial;
      await span('sqlite_transaction', () => db.withExclusiveTransactionAsync(async tx => {
        const current = await readInTransaction(tx, trace);
        result = mutate(current ? copy(current.state) : null);
        if (result && typeof result.then === 'function') throw new Error('Storage mutations must be synchronous.');
        if (!result || !validCredential(result.household?.credential)) throw new Error(LOCKED);
        const data = { nativeStorageVersion: 1, credentialId: current ? current.credentialId : await randomId(), state: copy(result) };
        const record = data.state.household.credential;
        delete data.state.household.credential;
        if (current) {
          if (JSON.stringify(record) !== JSON.stringify(current.state.household.credential)) throw new Error('PIN changes are outside this milestone.');
          await tx.runAsync("UPDATE installation SET payload = ? WHERE id = 1 AND phase = 'ready'", JSON.stringify(data));
        } else {
          if (data.state.storageVersion !== 1 || data.state.household.policy?.practiceMode !== 'require_parent_approval' ||
            data.state.household.policy?.revision !== 1 || data.state.assignments?.length !== 0) throw new Error(LOCKED);
          // Last cancellation checkpoint before issuing the first durable household write.
          beforeInitialize?.();
          await tx.runAsync("INSERT INTO installation (id, phase, payload) VALUES (1, 'pending', ?)", JSON.stringify(data));
          initial = { id: data.credentialId, record };
        }
      }));
      if (initial) {
        // The committed pending row binds the two stores. Never overwrite an existing secret.
        if (await span('secure_read', () => secureStore.getItemAsync(CREDENTIAL_KEY)) !== null) throw new Error(LOCKED);
        try { await span('secure_write', () => secureStore.setItemAsync(CREDENTIAL_KEY, JSON.stringify(initial))); }
        catch { throw new Error(LOCKED); }
        // A credential-write/SQLite-finalization interruption is safely resumable on the next read.
        await span('binding', () => span('sqlite_transaction', () => db.withExclusiveTransactionAsync(async tx => { await readInTransaction(tx, trace); })));
      }
      return result;
    }, trace);
  }
  return { read, update };
}
module.exports = { createSqliteStore };
