function fail(code) { const e = new Error(code); e.code = code; throw e; }
// INTERNAL ONLY: store must be bound to one trusted household/installation scope.
// No request household ID selects a store. authorizedSavedScope is supplied by the
// future trusted coordinator, never from UI/request data; its object is not authenticated here.
// This factory is not an authentication boundary or a source-deletion API.
function createCaptureImageAdoption({ store, files, newOwner, now, authorizedSavedScope = async () => false }) {
  async function duplicates(state) {
    const allowedBefore = await authorizedSavedScope();
    const m = await store.load();
    const matches = m.assets.filter(a => a.id !== state.assetId && a.sha256 === state.digest && a.bytes === state.bytes &&
      m.availability.some(v => v.id === a.id && v.status === 'available' && v.integrity !== 'corrupt'));
    const own = matches.filter(a => a.pageId !== state.pageId && m.pages.some(p => p.id === a.pageId && p.currentAssetId === a.id && p.captureId === state.input.captureId));
    const results = own.length ? [{ category: 'current_capture', count: own.length }] : [];
    // No saved IDs, titles, URIs or content returned, even on an authorized match.
    const allowedAfter = await authorizedSavedScope();
    if (allowedBefore && typeof allowedBefore === 'object' && allowedBefore === allowedAfter) {
      const saved = matches.filter(a => !own.includes(a) && m.pages.some(p => p.id === a.pageId &&
        m.captures.some(c => c.id === p.captureId && c.status === 'saved')));
      if (saved.length) results.push({ category: 'saved_worksheet', count: saved.length });
    }
    return results;
  }
  async function adopt(request, input) {
    // Private source references must be within explicitly configured capture temp roots.
    files.verifySource(input.sourceUri);
    let existing;
    try { existing = await store.adoptionState(request.operationId); } catch (e) { if (e.code !== 'operation_not_found') throw e; }
    if (!existing) {
      const source = await files.sourceInfo(input.sourceUri);
      if (!source.exists) fail('source_missing');
      await files.capacity(source.bytes);
    }
    let state = await store.reserveAdoption(request, input);
    if (state.phase === 'completed') {
      const m = await store.load(); const asset = m.assets.find(a => a.id === state.assetId);
      const observation = await files.verify(asset);
      await store.recordImageObservation(`check-${newOwner()}`, m.revision, asset.id, observation);
      if (observation.integrity !== 'verified') fail(observation.status === 'unexpectedly_missing' ? 'image_missing' : 'integrity_mismatch');
      return { asset, duplicates: await duplicates(state), observation };
    }
    const owner = newOwner(); state = await store.claimAdoption(request.operationId, owner);
    async function guard() {
      const latest = await store.adoptionState(request.operationId);
      if (latest.owner !== owner || latest.leaseUntil <= now()) fail('ownership_lost');
    }
    try {
      if (state.phase === 'reserved') {
        const source = await files.sourceInfo(input.sourceUri);
        await files.capacity(source.bytes);
        const prepared = await files.prepare(input.sourceUri, request.operationId, owner, guard);
        if (prepared.decoded.width !== input.width || prepared.decoded.height !== input.height || prepared.decoded.mime !== input.mime) fail('metadata_mismatch');
        state = await store.checkpointAdoption(request.operationId, owner, 'hashed', { digest: prepared.digest, bytes: prepared.bytes });
        // Persist staging owner so a restart can use its exact immutable staging candidate.
      }
      if (state.phase === 'hashed') {
        // The stage key is derived from the owner that created the hashed checkpoint.
        await files.finalize(request.operationId, state.stagingOwner || owner, state, guard);
        state = await store.checkpointAdoption(request.operationId, owner, 'finalized');
      }
      if (state.phase === 'finalized') {
        const verified = await files.verify({ id: state.assetId, sha256: state.digest, bytes: state.bytes });
        if (verified.integrity !== 'verified') fail(verified.status === 'unexpectedly_missing' ? 'image_missing' : 'integrity_mismatch');
        await guard(); state = await store.checkpointAdoption(request.operationId, owner, 'completed');
      }
      const m = await store.load();
      return { asset: m.assets.find(a => a.id === state.assetId), duplicates: await duplicates(state), observation: { status: 'available', integrity: 'verified' } };
    } finally {
      // Release only our token; never clear a newer recovery owner's lease.
      const latest = await store.adoptionState(request.operationId);
      if (latest.owner === owner) await store.releaseAdoption(request.operationId, owner);
    }
  }
  async function verify(assetId) {
    const m = await store.load(); const asset = m.assets.find(a => a.id === assetId);
    if (!asset) fail('asset_not_found');
    const status = m.availability.find(a => a.id === assetId);
    if (status.status === 'intentionally_deleted') return { status: status.status, integrity: status.integrity };
    const observation = await files.verify(asset);
    await store.recordImageObservation(`check-${newOwner()}`, m.revision, assetId, observation);
    return observation;
  }
  async function safe(action) {
    try { return await action(); } catch (e) {
      if (typeof e.code === 'string' && /^[a-z]+(?:_[a-z]+)*$/.test(e.code)) throw e;
      fail('image_io_failed'); // Native/driver exceptions may contain private paths.
    }
  }
  return { adopt: (...args) => safe(() => adopt(...args)), verify: assetId => safe(() => verify(assetId)),
    availability: assetId => safe(async () => {
      const m = await store.load(); const observation = m.availability.find(a => a.id === assetId);
      if (!observation) fail('asset_not_found');
      return { status: observation.status, integrity: observation.integrity,
        verification: observation.status === 'available' ? 'not_recently_verified' : 'not_applicable' };
    }) };
}
module.exports = { createCaptureImageAdoption };
