import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { createHouseholdService } from './householdService';
import { createSqliteStore } from './storage/sqliteStore';
import { nativePinCredential } from './parent/nativePinCredential';
import { createDevelopmentSample } from '../content/developmentSample';
import { createSetupDiagnostics } from './parent/setupDiagnostics';

const setupDiagnostics = createSetupDiagnostics({ enabled: __DEV__, now: () => performance.now(),
  emit: event => console.info('[FC-004N.1 setup]', JSON.stringify(event)) });

export const localHousehold = createHouseholdService({
  store: createSqliteStore({ openDatabase: () => SQLite.openDatabaseAsync('french-companion-local-v1.db'), secureStore: SecureStore,
    randomId: async () => Crypto.randomUUID(), validCredential: nativePinCredential.valid }),
  credential: nativePinCredential, sessionNow: () => performance.now(),
  development: __DEV__, sampleProvider: createDevelopmentSample, setupDiagnostics,
});
