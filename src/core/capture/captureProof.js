const proofAllowed = (development, platform) => development === true && platform === 'android';

function measurements(start, end, pages) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error('Invalid timing');
  return { elapsedMs: end - start, pageCount: pages.length, pages: pages.map(page => {
    if (![page.width, page.height, page.bytes].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('Invalid image metadata');
    return { ...page };
  }) };
}

// Leaving invalidates delivery, not the underlying native operation or its mutex.
function createOperationGuard() {
  let epoch = 0; let active = false; let busy = false;
  return {
    enter() { active = true; epoch++; },
    leave() { active = false; epoch++; },
    begin() { if (!active || busy) return null; busy = true; return epoch; },
    current(token) { return active && token === epoch; },
    finish() { busy = false; },
  };
}

// Only proof-owned files may be removed. Native scanner cache is never swept.
async function cleanupOwned(files, root) {
  const prefix = root.endsWith('/') ? root : `${root}/`;
  for (const file of files) {
    if (!file.uri.startsWith(prefix) || file.uri.slice(prefix.length).includes('/') || file.uri.includes('..')) throw new Error('Outside proof cache');
  }
  for (const file of files) if (file.exists) await file.delete();
}

module.exports = { proofAllowed, measurements, createOperationGuard, cleanupOwned };
