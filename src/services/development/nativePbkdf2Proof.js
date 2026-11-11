import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { createPbkdf2Proof } from './pbkdf2Proof';

// Optional loading keeps Expo Go/web launchable; no fallback to household PIN derivation.
export const nativePbkdf2Proof = createPbkdf2Proof({ development: __DEV__, platform: Platform.OS,
  loadModule: () => requireOptionalNativeModule('FcNativePbkdf2'), now: () => performance.now() });
