const { createIndexedDbStore } = require('./storage/indexedDbStore');
const { createPinCredential } = require('./parent/pinCredential');
const { createHouseholdService } = require('./householdService');
// Storage internals never leave this application service module.
const localHousehold = createHouseholdService({
  store: createIndexedDbStore(globalThis.indexedDB), credential: createPinCredential(globalThis.crypto),
});
module.exports = { localHousehold };
