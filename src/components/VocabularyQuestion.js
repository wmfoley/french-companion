import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export default function VocabularyQuestion({ question, response, number, total, onSubmit, onNext }) {
  const [selected, setSelected] = useState(null);
  const optionRefs = useRef({});
  const completed = Boolean(response?.outcome);
  const attempts = response?.attempts || [];
  const incorrectIds = attempts.filter(attempt => !attempt.isCorrect).map(attempt => attempt.selectedItemId);
  const available = question.options.filter(option => !incorrectIds.includes(option.id));
  function handleKey(event, optionId) {
    if (completed || incorrectIds.includes(optionId)) return;
    if ([' ', 'Enter'].includes(event.key)) {
      event.preventDefault();
      setSelected(optionId);
    } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
      const next = available[(available.findIndex(option => option.id === optionId) + direction + available.length) % available.length];
      setSelected(next.id);
      optionRefs.current[next.id]?.focus();
    }
  }
  return (
    <View style={styles.container}>
      <Text style={styles.progress}>Question {number} sur {total}</Text>
      <Text accessibilityRole="header" style={styles.heading}>Quel mot correspond à cette définition ?</Text>
      <Text style={styles.definition}>{question.definition}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Choisis un mot" style={styles.container}>
        {question.options.map(option => {
          const incorrect = incorrectIds.includes(option.id);
          const disabled = completed || incorrect;
          return (
            <Pressable key={option.id} ref={ref => { optionRefs.current[option.id] = ref; }}
              {...(Platform.OS === 'web' ? { 'aria-checked': selected === option.id, 'aria-disabled': disabled,
                tabIndex: !disabled && option.id === (selected || available[0]?.id) ? 0 : -1, onKeyDownCapture: event => handleKey(event, option.id) } : {})}
              accessibilityRole="radio" accessibilityState={{ checked: selected === option.id, disabled }}
              disabled={disabled} onPress={() => setSelected(option.id)}
              style={[styles.option, selected === option.id && styles.selected, disabled && styles.disabled]}>
              <Text style={styles.optionText}>{option.text}{incorrect ? ' — Déjà essayé' : selected === option.id ? ' — Choisi' : ''}</Text>
            </Pressable>
          );
        })}
      </View>
      <View accessibilityLiveRegion="polite">
        {attempts.length === 1 && !completed && <Text style={styles.feedback}>Bonne tentative ! Essaie un autre mot.</Text>}
        {completed && <>
          <Text style={styles.feedback}>{response.outcome === 'incorrect_after_two_attempts' ? 'Tu apprends en essayant. Découvrons ce mot ensemble !' : 'Bravo ! Tu as trouvé le mot.'}</Text>
          <Text style={styles.answer}>{question.correctTerm} : {question.definition}</Text>
        </>}
      </View>
      {completed ? (
        <Pressable accessibilityRole="button" onPress={onNext} style={styles.button}><Text style={styles.buttonText}>{number === total ? 'Terminer' : 'Suivant'}</Text></Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !selected }} disabled={!selected}
          onPress={() => { onSubmit(selected); setSelected(null); }} style={[styles.button, !selected && styles.disabled]}>
          <Text style={styles.buttonText}>Vérifier</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 }, progress: { fontSize: 16, color: '#395448' },
  heading: { fontSize: 26, fontWeight: '700', color: '#174b3e' },
  definition: { fontSize: 22, lineHeight: 32, color: '#243b33' },
  option: { padding: 18, minHeight: 56, borderRadius: 12, borderWidth: 2, borderColor: '#789384', backgroundColor: '#ffffff' },
  selected: { borderColor: '#174b3e', backgroundColor: '#e0efe5' }, disabled: { opacity: 0.65 },
  optionText: { fontSize: 20, color: '#243b33' }, feedback: { fontSize: 20, lineHeight: 30, color: '#174b3e' },
  answer: { fontSize: 20, lineHeight: 30, marginTop: 12, color: '#243b33' },
  button: { padding: 18, minHeight: 56, borderRadius: 12, backgroundColor: '#174b3e' },
  buttonText: { fontSize: 20, fontWeight: '600', color: '#ffffff', textAlign: 'center' },
});
