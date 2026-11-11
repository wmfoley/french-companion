import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { createPinCredential } from './pinCredential';
import { createNativePinEngine } from './nativePinEngine';

const engine = createNativePinEngine(size => Crypto.getRandomBytesAsync(size),
  () => Platform.OS === 'android' ? requireOptionalNativeModule('FcNativePbkdf2') : null);
export const nativePinCredential = { ...createPinCredential(null, engine), assertAvailable: engine.assertAvailable };
