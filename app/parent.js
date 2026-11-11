import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { AppState, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Screen from '../src/components/Screen';
import { localHousehold } from '../src/services/localHousehold';
import { createParentOperations } from '../src/services/parent/parentOperations';

const STRICT = 'require_parent_approval';
const INDEPENDENT = 'allow_independent_practice';

export default function ParentArea() {
  const capability = useRef(null);
  const live = useRef(false);
  const [operations] = useState(createParentOperations);
  const [stage, setStage] = useState('loading');
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [policy, setPolicy] = useState(null);
  const [choice, setChoice] = useState(STRICT);
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [verificationMs, setVerificationMs] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  useEffect(() => {
    if (!__DEV__ || Platform.OS === 'web') return;
    const update = () => setDiagnostics(localHousehold.readSetupDiagnostics());
    update();
    return localHousehold.subscribeSetupDiagnostics(update);
  }, []);
  const lock = useCallback(() => {
    operations.invalidate(); setBusy(false);
    localHousehold.lock(); capability.current = null;
    setPin(''); setConfirmation(''); setPolicy(null); setAcknowledgeRisk(false);
    if (live.current) setStage(current => ['setup', 'error', 'loading'].includes(current) ? current : 'unlock');
  }, [operations]);
  const activity = useCallback(() => {
    if (capability.current) {
      try { localHousehold.noteParentActivity(capability.current); } catch { lock(); }
    }
  }, [lock]);
  useFocusEffect(useCallback(() => {
    live.current = true;
    const focus = operations.enter();
    setStage('loading'); setMessage('');
    localHousehold.status().then(status => { if (operations.isFocus(focus)) setStage(status.needsSetup ? 'setup' : 'unlock'); })
      .catch(error => { if (operations.isFocus(focus)) { setMessage(error.message); setStage('error'); } });
    return () => { live.current = false; operations.leave(); lock(); };
  }, [lock, operations]));
  useEffect(() => {
    const refresh = () => {
      const focus = operations.focusId();
      if (!operations.isFocus(focus)) return;
      setStage('loading');
      localHousehold.status().then(status => { if (operations.isFocus(focus)) setStage(status.needsSetup ? 'setup' : 'unlock'); })
        .catch(error => { if (operations.isFocus(focus)) { setMessage(error.message); setStage('error'); } });
    };
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') lock(); else refresh(); });
    const visibility = () => { if (document.visibilityState !== 'visible') lock(); else refresh(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    const timer = setInterval(() => {
      const focus = operations.focusId();
      if (capability.current) localHousehold.getParentPolicy(capability.current).catch(() => { if (operations.isFocus(focus)) { lock(); setMessage('Parent access expired. Enter your PIN again.'); } });
    }, 1000);
    return () => { listener.remove(); clearInterval(timer); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility); };
  }, [lock, operations]);
  async function run(action) {
    const operation = operations.begin();
    if (!operation) return;
    const current = () => operations.isCurrent(operation);
    setBusy(true); setMessage('');
    try { await action(current); } catch (error) { if (current()) setMessage(error.message); }
    finally { if (operations.finish(operation)) { setPin(''); setConfirmation(''); setBusy(false); } }
  }
  async function open(current) {
    const start = performance.now();
    const token = await localHousehold.unlock(pin);
    if (!current()) return;
    setVerificationMs(Math.round(performance.now() - start));
    capability.current = token;
    const saved = await localHousehold.getParentPolicy(token);
    if (!current() || capability.current !== token) return;
    setPolicy(saved); setChoice(saved.practiceMode); setStage('policy');
  }
  return <Screen onInteraction={activity}>
    <Text accessibilityRole="header" style={styles.title}>Parent Area</Text>
    <Text style={styles.body}>One household, one local PIN. Settings stay on this {Platform.OS === 'web' ? 'browser installation' : 'device installation'}.</Text>
    {stage === 'loading' && <Text style={styles.body}>Loading local settings…</Text>}
    {stage === 'setup' && <>
      <Text style={styles.body}>Set up once with a parent present. Choose a six-digit PIN your child does not know. Forgotten PINs cannot be reset in the app. Missing or inconsistent credentials leave access locked and keep household data; there is no automatic reset.</Text>
      <TextInput accessibilityLabel="New six-digit parent PIN" placeholder="Six-digit PIN" placeholderTextColor="#52665e" selectionColor="#174b3e" cursorColor="#174b3e" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} style={styles.input} />
      <TextInput accessibilityLabel="Confirm parent PIN" placeholder="Confirm PIN" placeholderTextColor="#52665e" selectionColor="#174b3e" cursorColor="#174b3e" value={confirmation} onChangeText={setConfirmation} secureTextEntry keyboardType="number-pad" maxLength={6} style={styles.input} />
      <Action disabled={busy} onPress={() => run(async current => { await localHousehold.setup(pin, confirmation); if (current()) { setStage('unlock'); setMessage('Setup saved. Strict approval is the default. Enter your PIN to change policy.'); } })}>Save household setup</Action>
    </>}
    {stage === 'unlock' && <>
      <TextInput accessibilityLabel="Parent PIN" placeholder="Parent PIN" placeholderTextColor="#52665e" selectionColor="#174b3e" cursorColor="#174b3e" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} style={styles.input} />
      <Action disabled={busy} onPress={() => run(open)}>Unlock Parent Area</Action>
    </>}
    {stage === 'policy' && <>
      <Text style={styles.body}>Saved policy: {policy?.practiceMode === INDEPENDENT ? 'Independent practice allowed' : 'Parent approval required'}</Text>
      {__DEV__ && <>
        {verificationMs !== null && <Text style={styles.body}>Development timing: last unlock took {verificationMs} ms (PIN derivation plus local storage).</Text>}
        <Action disabled={busy} onPress={() => run(async current => {
          await localHousehold.loadDevelopmentSample(capability.current);
          if (current()) setMessage('Development sample loaded, still pending review. Household policy controls practice; production builds exclude it.');
        })}>Load development sample</Action>
      </>}
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
      <Action disabled={busy || (choice === INDEPENDENT && !acknowledgeRisk)} onPress={() => run(async current => {
        const saved = await localHousehold.setPracticePolicy(capability.current, { expectedRevision: policy.revision, practiceMode: choice, acknowledgeRisk });
        if (current() && capability.current) { setPolicy(saved); setAcknowledgeRisk(false); setMessage('Household policy saved. Assignment review and source fidelity are unchanged.'); }
      })}>Save practice policy</Action>
      <Action disabled={busy} onPress={() => { lock(); setMessage('Parent Area locked.'); }}>Lock Parent Area</Action>
    </>}
    <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>
    {busy && <Text accessibilityLiveRegion="polite" style={styles.body}>Working… please wait.</Text>}
    {__DEV__ && Platform.OS !== 'web' && <View style={styles.notice}>
      <Text style={styles.body}>Development setup diagnostics — stages and milliseconds only. Slow warnings do not cancel setup or permit a retry.</Text>
      {diagnostics.map((event, index) => <Text key={index} selectable style={styles.diagnostic}>
        {`#${event.operation} ${event.stage} ${event.event}: stage ${event.durationMs} ms, total ${event.elapsedMs} ms${event.category ? ` (${event.category})` : ''}`}
      </Text>)}
    </View>}
    <Link href="/" style={styles.link}>Return to student home</Link>
  </Screen>;
}

function Action({ children, disabled, onPress }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={[styles.button, disabled && { opacity: 0.6 }]}><Text style={styles.buttonText}>{children}</Text></Pressable>;
}
const styles = StyleSheet.create({
  diagnostic: { fontSize: 14, lineHeight: 20, color: '#243b33' },
  title: { fontSize: 28, fontWeight: '700', color: '#174b3e' }, body: { fontSize: 18, lineHeight: 28, color: '#243b33' },
  input: { padding: 16, minHeight: 52, borderWidth: 1, borderColor: '#789384', borderRadius: 8, backgroundColor: '#fff', color: '#243b33', fontSize: 20 },
  button: { backgroundColor: '#174b3e', padding: 16, borderRadius: 10, minHeight: 52 }, buttonText: { color: '#fff', fontSize: 18 },
  notice: { gap: 16, padding: 16, backgroundColor: '#fff3cb', borderRadius: 8 }, link: { fontSize: 18, paddingVertical: 16, color: '#174b3e' },
});
