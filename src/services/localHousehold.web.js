const { createIndexedDbStore } = require('./storage/indexedDbStore');
const { createPinCredential } = require('./parent/pinCredential');
const { createHouseholdService } = require('./householdService');
const { createDevelopmentSample } = require('../content/developmentSample');
// Storage internals never leave this application service module.
const localHousehold = createHouseholdService({
  store: createIndexedDbStore(globalThis.indexedDB), credential: createPinCredential(globalThis.crypto),
  sessionNow: () => performance.now(), development: typeof __DEV__ !== 'undefined' && __DEV__, sampleProvider: createDevelopmentSample,
});
module.exports = { localHousehold };
