import { useCallback, useState } from 'react';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import Screen from '../src/components/Screen';
import VocabularyQuestion from '../src/components/VocabularyQuestion';
import referenceAssignment from '../src/content/fixtures/grade4-reference.json';
import { normalizeAssignment } from '../src/core/assignments/normalizeAssignment';
import { generateVocabularyQuestions, resolveVocabularyQuestion } from '../src/core/exercises/vocabularyMultipleChoice';
import { createSession, submitAnswer, advanceSession, summarizeSession } from '../src/core/sessions/practiceSession';

export default function PracticeScreen() {
  const { mode } = useLocalSearchParams();
  const demo = __DEV__ && mode === 'demo';
  return <Practice key={demo ? 'demo' : 'practice'} demo={demo} />;
}

function Practice({ demo }) {
  const [content] = useState(() => {
    const assignment = normalizeAssignment(referenceAssignment);
    return { assignment, ...generateVocabularyQuestions(assignment, { mode: demo ? 'demo' : 'practice', development: __DEV__ }) };
  });
  const [session, setSession] = useState(null);
  useFocusEffect(useCallback(() => () => setSession(null), []));
  const { assignment, questions } = content;
  const question = session && !session.finished ? questions[session.index] : null;
  const summary = session ? summarizeSession(session) : null;
  return (
    <Screen>
      {demo && <Text accessibilityRole="header" style={styles.banner}>Démo — contenu en attente de validation</Text>}
      {!questions.length ? <>
        <Text accessibilityRole="header" style={styles.title}>Ta leçon se prépare</Text>
        <Text style={styles.body}>{assignment.reviewStatus !== 'approved' && !demo ? 'Cette leçon attend la validation d’un parent avant de commencer.' : 'Il faut au moins trois mots avec des définitions différentes pour cette activité.'}</Text>
      </> : !session ? <>
        <Text accessibilityRole="header" style={styles.title}>Jouons avec les mots !</Text>
        <Text style={styles.body}>Lis une définition et choisis le mot qui correspond. Tu peux essayer une deuxième fois.</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setSession(createSession(questions))}><Text style={styles.buttonText}>C’est parti !</Text></Pressable>
      </> : session.finished ? <>
        <Text accessibilityRole="header" style={styles.title}>Bravo pour tes efforts !</Text>
        <Text style={styles.body}>Tu as exploré {summary.completed} mots. Chaque essai t’aide à apprendre.</Text>
        <Text style={styles.body}>{summary.incorrectAfterTwoAttempts ? 'Certains mots se découvrent petit à petit. Tu pourras les revoir tranquillement.' : 'Tu as trouvé tous les mots, parfois avec un deuxième essai. Continue comme ça !'}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setSession(createSession(questions))}><Text style={styles.buttonText}>Rejouer</Text></Pressable>
      </> : <VocabularyQuestion key={question.id} question={resolveVocabularyQuestion(question, assignment)} response={session.responses[question.id]}
        number={session.index + 1} total={questions.length}
        onSubmit={selected => setSession(current => submitAnswer(current, question, selected))}
        onNext={() => setSession(current => advanceSession(current, question.id))} />}
      <Link href="/" style={styles.link}>Retour à l’accueil</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#174b3e' },
  body: { fontSize: 20, lineHeight: 30, color: '#243b33' },
  banner: { fontSize: 18, lineHeight: 28, padding: 16, borderWidth: 2, borderColor: '#81621b', borderRadius: 8, backgroundColor: '#fff3cb', color: '#59420d' },
  link: { fontSize: 20, paddingVertical: 16, minHeight: 48, color: '#174b3e', textDecorationLine: 'underline' },
  button: { padding: 18, minHeight: 56, borderRadius: 12, backgroundColor: '#174b3e' },
  buttonText: { fontSize: 20, fontWeight: '600', color: '#ffffff', textAlign: 'center' },
});
