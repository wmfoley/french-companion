const { sha256 } = require('@noble/hashes/sha2.js');
const safeId = x => typeof x === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x);
function fail(code) { const e = new Error(code); e.code = code; throw e; }
// Driver owns platform-specific file access; this adapter never removes a source file.
function createCaptureImageFiles({ driver, rootUri, temporaryRoots }) {
  const safeUri = uri => typeof uri === 'string' && uri.startsWith('file://') && !/[\\%?#]/.test(uri) && !uri.split('/').includes('..');
  if (!safeUri(rootUri) || !rootUri.endsWith('/') || !Array.isArray(temporaryRoots) ||
    !temporaryRoots.length || temporaryRoots.some(r => !safeUri(r) || !r.endsWith('/') || r.startsWith(rootUri) || rootUri.startsWith(r))) fail('invalid_roots');
  function source(uri) { if (!safeUri(uri) || !temporaryRoots.some(r => uri.startsWith(r))) fail('invalid_source'); return uri; }
  function assetUri(assetId) { if (!safeId(assetId)) fail('invalid_identity'); return `${rootUri}assets/${assetId}`; }
  function stageUri(operationId, owner) { if (![operationId, owner].every(safeId)) fail('invalid_identity'); return `${rootUri}staging/${operationId}-${owner}`; }
  async function stat(uri) {
    const result = await driver.stat(uri);
    if (!result || typeof result.exists !== 'boolean') fail('file_state_unknown');
    return result; // Driver must throw on access uncertainty, never call it confirmed absence.
  }
  async function digest(uri) {
    const info = await stat(uri); if (!info.exists) fail('image_missing');
    if (!Number.isSafeInteger(info.bytes) || info.bytes <= 0 || info.isFile !== true) fail('invalid_image');
    const hash = sha256.create(); let length = 0;
    for await (const chunk of driver.chunks(uri, 65536)) {
      if (!(chunk instanceof Uint8Array) || chunk.length > 65536) fail('invalid_chunk');
      length += chunk.length; if (length > info.bytes) fail('image_changed'); hash.update(chunk);
    }
    if (length !== info.bytes || (await stat(uri)).bytes !== length) fail('partial_copy');
    return { digest: Array.from(hash.digest(), b => b.toString(16).padStart(2, '0')).join(''), bytes: length };
  }
  return {
    assetUri,
    sourceInfo: async uri => { source(uri); return stat(uri); },
    capacity: async bytes => {
      const available = await driver.availableBytes();
      if (!Number.isSafeInteger(bytes) || bytes <= 0 || !Number.isSafeInteger(available) || available < 0) fail('capacity_unknown');
      if (available < bytes * 2) fail('insufficient_storage');
    },
    prepare: async (uri, operationId, owner, guard) => {
      source(uri); const info = await stat(uri);
      if (!info.exists) fail('source_missing');
      if (!Number.isSafeInteger(info.bytes) || info.bytes <= 0 || info.isFile !== true) fail('invalid_image');
      const decoded = await driver.imageInfo(uri);
      if (![decoded.width, decoded.height].every(n => Number.isSafeInteger(n) && n > 0)) fail('invalid_image');
      const before = await digest(uri); await guard();
      await driver.mkdir(`${rootUri}staging/`); await driver.mkdir(`${rootUri}assets/`);
      const stage = stageUri(operationId, owner);
      // Exclusive copy; never overwrite or remove an ambiguous staging file.
      await driver.copyExclusive(uri, stage); await guard();
      const after = await digest(stage); const original = await digest(uri);
      if (before.digest !== after.digest || before.digest !== original.digest || before.bytes !== after.bytes) fail('hash_mismatch');
      return { ...after, stage, decoded };
    },
    finalize: async (operationId, owner, state, guard) => {
      const final = assetUri(state.assetId); const stage = stageUri(operationId, owner);
      await guard();
      if (!(await stat(final)).exists) {
        const checked = await digest(stage);
        if (checked.digest !== state.digest || checked.bytes !== state.bytes) fail('hash_mismatch');
        await driver.finalizeExclusive(stage, final); // Driver must provide no-replace semantics.
      }
      await guard(); const checked = await digest(final);
      if (checked.digest !== state.digest || checked.bytes !== state.bytes) fail('hash_mismatch');
      return checked;
    },
    verify: async asset => {
      const uri = assetUri(asset.id); const info = await stat(uri);
      if (!info.exists) return { status: 'unexpectedly_missing', integrity: 'unknown' };
      const actual = await digest(uri);
      return { status: 'available', integrity: actual.digest === asset.sha256 && actual.bytes === asset.bytes ? 'verified' : 'corrupt' };
    },
    verifySource: source,
  };
}
module.exports = { createCaptureImageFiles };
