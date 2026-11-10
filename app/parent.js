import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { AppState, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Screen from '../src/components/Screen';
import { localHousehold } from '../src/services/localHousehold';

const STRICT = 'require_parent_approval';
const INDEPENDENT = 'allow_independent_practice';

export default function ParentArea() {
  const capability = useRef(null);
  const live = useRef(false);
  const [stage, setStage] = useState('loading');
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [policy, setPolicy] = useState(null);
  const [choice, setChoice] = useState(STRICT);
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useCallback(() => {
    localHousehold.lock(); capability.current = null;
    setPin(''); setConfirmation(''); setPolicy(null); setAcknowledgeRisk(false);
    if (live.current) setStage(current => ['setup', 'error', 'loading'].includes(current) ? current : 'unlock');
  }, []);
  useFocusEffect(useCallback(() => {
    live.current = true;
    localHousehold.status().then(status => { if (live.current) setStage(status.needsSetup ? 'setup' : 'unlock'); })
      .catch(error => { if (live.current) { setMessage(error.message); setStage('error'); } });
    return () => { live.current = false; lock(); };
  }, [lock]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') lock(); });
    const visibility = () => { if (document.visibilityState !== 'visible') lock(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    const timer = setInterval(() => {
      if (capability.current) localHousehold.getParentPolicy(capability.current).catch(() => { lock(); setMessage('Parent access expired. Enter your PIN again.'); });
    }, 1000);
    return () => { listener.remove(); clearInterval(timer); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility); };
  }, [lock]);
  async function run(action) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { if (live.current) setMessage(error.message); }
    finally { setPin(''); setConfirmation(''); setBusy(false); }
  }
  async function open() {
    const token = await localHousehold.unlock(pin);
    if (!live.current) { localHousehold.lock(); return; }
    capability.current = token;
    const saved = await localHousehold.getParentPolicy(token);
    if (!live.current || capability.current !== token) return;
    setPolicy(saved); setChoice(saved.practiceMode); setStage('policy');
  }
  return <Screen>
    <Text accessibilityRole="header" style={styles.title}>Parent Area</Text>
    <Text style={styles.body}>One household, one local PIN. Settings stay on this browser installation.</Text>
    {stage === 'loading' && <Text style={styles.body}>Loading local settings…</Text>}
    {stage === 'setup' && <>
      <Text style={styles.body}>Set up once with a parent present. Choose a six-digit PIN your child does not know. Forgotten PINs cannot be reset in the app; clearing browser data removes local settings and assignments.</Text>
      <TextInput accessibilityLabel="New six-digit parent PIN" placeholder="Six-digit PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} style={styles.input} />
      <TextInput accessibilityLabel="Confirm parent PIN" placeholder="Confirm PIN" value={confirmation} onChangeText={setConfirmation} secureTextEntry keyboardType="number-pad" maxLength={6} style={styles.input} />
      <Action disabled={busy} onPress={() => run(async () => { await localHousehold.setup(pin, confirmation); if (live.current) { setStage('unlock'); setMessage('Setup saved. Strict approval is the default. Enter your PIN to change policy.'); } })}>Save household setup</Action>
    </>}
    {stage === 'unlock' && <>
      <TextInput accessibilityLabel="Parent PIN" placeholder="Parent PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} style={styles.input} />
      <Action disabled={busy} onPress={() => run(open)}>Unlock Parent Area</Action>
    </>}
    {stage === 'policy' && <>
      <Text style={styles.body}>Saved policy: {policy?.practiceMode === INDEPENDENT ? 'Independent practice allowed' : 'Parent approval required'}</Text>
      <Action disabled={busy} onPress={() => { setChoice(STRICT); setAcknowledgeRisk(false); }}>Require parent approval before practice{choice === STRICT ? ' — Selected' : ''}</Action>
      <Action disabled={busy} onPress={() => { setChoice(INDEPENDENT); setAcknowledgeRisk(false); }}>Allow independent practice{choice === INDEPENDENT ? ' — Selected' : ''}</Action>
      {choice === INDEPENDENT && <View style={styles.notice}>
        <Text style={styles.body}>Your child may practise structurally valid, eligible assignments before you review them. Transcription or interpretation errors may remain. This does not approve any assignment or verify the original worksheet.</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acknowledgeRisk }}
          {...(Platform.OS === 'web' ? { 'aria-checked': acknowledgeRisk, onKeyDownCapture: event => {
            if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); setAcknowledgeRisk(value => !value); }
          } } : {})} onPress={() => setAcknowledgeRisk(value => !value)} style={styles.input}>
          <Text style={styles.body}>{acknowledgeRisk ? '☑' : '☐'} I understand and accept this risk for independent practice.</Text>
        </Pressable>
      </View>}
      <Action disabled={busy || (choice === INDEPENDENT && !acknowledgeRisk)} onPress={() => run(async () => {
        const saved = await localHousehold.setPracticePolicy(capability.current, { expectedRevision: policy.revision, practiceMode: choice, acknowledgeRisk });
        if (live.current && capability.current) { setPolicy(saved); setAcknowledgeRisk(false); setMessage('Household policy saved. Assignment review and source fidelity are unchanged.'); }
      })}>Save practice policy</Action>
      <Action disabled={busy} onPress={() => { lock(); setMessage('Parent Area locked.'); }}>Lock Parent Area</Action>
    </>}
    <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>
    <Link href="/" style={styles.link}>Return to student home</Link>
  </Screen>;
}

function Action({ children, disabled, onPress }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={[styles.button, disabled && { opacity: 0.6 }]}><Text style={styles.buttonText}>{children}</Text></Pressable>;
}
const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#174b3e' }, body: { fontSize: 18, lineHeight: 28, color: '#243b33' },
  input: { padding: 16, minHeight: 52, borderWidth: 1, borderColor: '#789384', borderRadius: 8, backgroundColor: '#fff', fontSize: 20 },
  button: { backgroundColor: '#174b3e', padding: 16, borderRadius: 10, minHeight: 52 }, buttonText: { color: '#fff', fontSize: 18 },
  notice: { gap: 16, padding: 16, backgroundColor: '#fff3cb', borderRadius: 8 }, link: { fontSize: 18, paddingVertical: 16, color: '#174b3e' },
});
