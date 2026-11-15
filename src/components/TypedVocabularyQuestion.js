import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { canSubmitTypedDraft } from './typedVocabularyInput';

export default function TypedVocabularyQuestion({ question, response, number, total, onSubmit, onNext }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const completed = Boolean(response?.outcome);
  const canSubmit = canSubmitTypedDraft(draft, response, busy);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  async function submit() {
    if (!mounted.current || submitting.current || !canSubmit) return;
    submitting.current = true;
    setBusy(true);
    try { await onSubmit(draft); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  return <View style={styles.container}>
    <Text style={styles.progress}>Question {number} sur {total}</Text>
    <Text accessibilityRole="header" style={styles.heading}>Écris le terme qui correspond à cette définition.</Text>
    <Text accessibilityLabel="Définition à retrouver" style={styles.definition}>{question.definition}</Text>
    <Text style={styles.body}>Écris le terme complet, avec son article (un, une, le, la) s’il en a un.</Text>
    <TextInput accessibilityLabel="Ta réponse en français" placeholder="Écris le terme complet" placeholderTextColor="#52665e"
      value={draft} onChangeText={setDraft} editable={!completed}
      autoCorrect={false} autoCapitalize="none" spellCheck={false} autoComplete="off" importantForAutofill="no"
      keyboardType="default" returnKeyType="done" submitBehavior="submit" blurOnSubmit={false} onSubmitEditing={submit}
      selectionColor="#174b3e" cursorColor="#174b3e" style={styles.input} />
    <View accessibilityLiveRegion="polite">
      {!completed && response?.attempts.length === 1 && <Text style={styles.feedback}>Bonne tentative ! Tu peux corriger ta réponse et réessayer.</Text>}
      {completed && question.feedback && <>
        <Text style={styles.feedback}>{response.outcome === 'incorrect_after_two_attempts' ? 'Tu apprends en essayant. Découvrons ce terme ensemble !' : 'Bravo ! Tu as trouvé le terme.'}</Text>
        <Text style={styles.answer}>{question.feedback.correctTerm} : {question.feedback.definition}</Text>
      </>}
    </View>
    {completed ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onNext} style={[styles.button, busy && styles.disabled]}>
      <Text style={styles.buttonText}>{number === total ? 'Terminer' : 'Suivant'}</Text>
    </Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Vérifier ma réponse" accessibilityState={{ disabled: !canSubmit, busy }}
      disabled={!canSubmit} onPress={submit} style={[styles.button, !canSubmit && styles.disabled]}>
      <Text style={styles.buttonText}>{busy ? 'Vérification…' : 'Vérifier'}</Text>
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 16 }, progress: { fontSize: 16, color: '#395448' },
  heading: { fontSize: 26, fontWeight: '700', color: '#174b3e' }, definition: { fontSize: 22, lineHeight: 32, color: '#243b33' },
  body: { fontSize: 18, lineHeight: 28, color: '#243b33' }, feedback: { fontSize: 20, lineHeight: 30, color: '#174b3e' },
  answer: { fontSize: 20, lineHeight: 30, color: '#243b33', marginTop: 12 },
  input: { minHeight: 56, padding: 16, fontSize: 22, color: '#243b33', backgroundColor: '#fff', borderWidth: 2, borderColor: '#789384', borderRadius: 12 },
  button: { minHeight: 56, padding: 18, borderRadius: 12, backgroundColor: '#174b3e' },
  buttonText: { fontSize: 20, fontWeight: '600', color: '#fff', textAlign: 'center' }, disabled: { opacity: 0.65 },
});
