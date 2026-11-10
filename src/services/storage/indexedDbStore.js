/** Single-record transactions serialize setup, policy CAS, cooldown and assignment writes across tabs. */
function createIndexedDbStore(indexedDB, name = 'french-companion-local-v1') {
  let opening;
  function open() {
    if (!indexedDB) return Promise.reject(new Error('Local persistence is unavailable.'));
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('local');
      request.onerror = () => reject(new Error('Unable to open local persistence.'));
      request.onblocked = () => reject(new Error('Close other French Companion tabs and retry.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  async function transaction(write, mutate) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('local', write ? 'readwrite' : 'readonly');
      const store = tx.objectStore('local');
      const request = store.get('installation');
      let result;
      let failure;
      request.onsuccess = () => {
        try {
          result = write ? mutate(request.result ?? null) : request.result ?? null;
          if (result && typeof result.then === 'function') throw new Error('Storage mutations must be synchronous.');
          if (write) store.put(result, 'installation');
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(failure || new Error('Local persistence failed; no permission change was saved.'));
    });
  }
  return { read: () => transaction(false), update: mutate => transaction(true, mutate) };
}

module.exports = { createIndexedDbStore };
