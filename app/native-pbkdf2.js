import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Platform, Pressable, Text } from 'react-native';
import Screen from '../src/components/Screen';
import { nativePbkdf2Proof } from '../src/services/development/nativePbkdf2Proof';

export default function NativePbkdf2Proof() {
  const focus = useRef(0);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => {
    focus.current++;
    return () => { focus.current++; running.current = false; setBusy(false); };
  }, []));
  const eligible = __DEV__ && Platform.OS === 'android';
  const available = eligible && nativePbkdf2Proof.available();
  async function run(vectorId) {
    if (running.current) return;
    running.current = true; setBusy(true); setMessage('');
    const visit = focus.current;
    try {
      const result = await nativePbkdf2Proof.run(vectorId);
      if (visit === focus.current) setResults(previous => [...previous, result].slice(-6));
    } catch (error) { if (visit === focus.current) setMessage(error.message); }
    finally { if (visit === focus.current) { running.current = false; setBusy(false); } }
  }
  return <Screen>
    <Text accessibilityRole="header" style={{ fontSize: 26 }}>Native PBKDF2 — development proof</Text>
    {!eligible ? <Text>Unavailable here. Use the Android development build. Household authentication is unchanged.</Text> : <>
      <Text>Public test inputs only. PBKDF2-HMAC-SHA256, 600,000 iterations, 16-byte salt, 32-byte result. No household storage or credentials are accessed.</Text>
      <Text>Device: {globalThis.HermesInternal ? 'Hermes' : 'runtime not confirmed as Hermes'}. Native module: {available ? 'available' : 'unavailable — install French Companion Dev; Expo Go cannot run this proof'}.</Text>
      <Text>Run both vectors once cold, then repeat for warm timings. Record responsiveness and results for review. Do not test household PIN setup yet.</Text>
      {['digits', 'leading-zero'].map(id => <Pressable key={id} accessibilityRole="button" disabled={busy || !available}
        accessibilityState={{ disabled: busy || !available }} onPress={() => run(id)}
        style={{ padding: 16, minHeight: 52, backgroundColor: busy || !available ? '#697b74' : '#174b3e', borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontSize: 18 }}>Run public vector: {id}</Text>
      </Pressable>)}
      {busy && <Text accessibilityLiveRegion="polite">Native proof running… Navigation remains available; leaving does not release the native concurrency guard.</Text>}
      {results.map((result, index) => <Text key={index} selectable accessibilityLiveRegion="polite">
        {`${result.passed ? 'PASS' : 'FAIL — output mismatch'}: ${result.vectorId}; native derivation ${result.derivationMs.toFixed(1)} ms; round trip ${result.roundTripMs.toFixed(1)} ms; background thread confirmed; Android API ${result.androidApi}`}
      </Text>)}
      <Text accessibilityLiveRegion="polite">{message}</Text>
    </>}
    <Link href="/">Return to student home</Link>
  </Screen>;
}
