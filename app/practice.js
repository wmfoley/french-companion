import { useCallback, useRef, useState } from 'react';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import Screen from '../src/components/Screen';
import VocabularyQuestion from '../src/components/VocabularyQuestion';
import referenceAssignment from '../src/content/fixtures/grade4-reference.json';
import { normalizeAssignment } from '../src/core/assignments/normalizeAssignment';
import { generateVocabularyQuestions, resolveVocabularyQuestion } from '../src/core/exercises/vocabularyMultipleChoice';
import { createSession, submitAnswer, advanceSession, summarizeSession } from '../src/core/sessions/practiceSession';
import { localHousehold } from '../src/services/localHousehold';

export default function PracticeScreen() {
  const { mode, assignmentId } = useLocalSearchParams();
  const demo = __DEV__ && mode === 'demo';
  return demo ? <Practice key="demo" demo /> : <HouseholdPractice key={String(assignmentId || '')} assignmentId={assignmentId} />;
}

function HouseholdPractice({ assignmentId }) {
  const [content, setContent] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [error, setError] = useState('');
  const active = useRef(false);
  const baseline = useRef(null);
  const verify = useCallback(async () => {
    try {
      const latest = await localHousehold.readPractice(assignmentId);
      if (!latest.eligibility.eligible || latest.document.contentRevision !== baseline.current) throw new Error('Cette leçon n’est plus disponible avec la politique actuelle du foyer.');
      if (active.current) return true;
    } catch { if (active.current) setError('La pratique est en pause. La politique du foyer a changé ou les données locales sont indisponibles.'); }
    return false;
  }, [assignmentId]);
  useFocusEffect(useCallback(() => {
    active.current = true;
    setError(''); setContent(null);
    async function load() {
      try {
        if (!assignmentId) {
          const list = await localHousehold.listPracticeAssignments();
          if (active.current) setAssignments(list);
          return;
        }
        const result = await localHousehold.readPractice(assignmentId);
        if (!result.eligibility.eligible) throw new Error('Cette leçon attend une autorisation selon la politique du foyer.');
        baseline.current = result.document.contentRevision;
        const generated = generateVocabularyQuestions(result.document.assignment, { householdPolicy: result.policy, approval: result.document.approval,
          contentRevision: result.document.contentRevision, purpose: result.document.purpose });
        if (active.current) setContent({ assignment: result.document.assignment, eligibility: result.eligibility, ...generated });
      } catch (failure) { if (active.current) setError(failure.message); }
    }
    load();
    const timer = setInterval(() => { if (assignmentId && baseline.current) verify(); }, 2000);
    return () => { active.current = false; baseline.current = null; clearInterval(timer); setContent(null); };
  }, [assignmentId, verify]));
  if (content && !error) return <Practice loadedContent={content} verify={verify} />;
  return <Screen>
    <Text accessibilityRole="header" style={styles.title}>Mes leçons</Text>
    {error ? <Text style={styles.body}>{error}</Text> : assignments ? <>
      {!assignments.length && <Text style={styles.body}>Aucune leçon enregistrée pour le moment. Le parent peut configurer la politique du foyer dans le Parent Area.</Text>}
      {assignments.map(item => item.eligible ? <Link key={item.id} href={{ pathname: '/practice', params: { assignmentId: item.id } }} style={styles.link}>{item.title}</Link> :
        <Text key={item.id} style={styles.body}>{item.title} — en attente d’autorisation</Text>)}
    </> : <Text style={styles.body}>Chargement des données locales…</Text>}
    <Link href="/" style={styles.link}>Retour à l’accueil</Link>
  </Screen>;
}

function Practice({ demo = false, loadedContent, verify = async () => true }) {
  const [content] = useState(() => {
    if (loadedContent) return loadedContent;
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
      {content.eligibility?.requiresUnreviewedNotice && <Text style={styles.banner}>Cette leçon n’a pas encore été vérifiée par un parent.</Text>}
      {!questions.length ? <>
        <Text accessibilityRole="header" style={styles.title}>Ta leçon se prépare</Text>
        <Text style={styles.body}>{assignment.reviewStatus !== 'approved' && !demo ? 'Cette leçon attend la validation d’un parent avant de commencer.' : 'Il faut au moins trois mots avec des définitions différentes pour cette activité.'}</Text>
      </> : !session ? <>
        <Text accessibilityRole="header" style={styles.title}>Jouons avec les mots !</Text>
        <Text style={styles.body}>Lis une définition et choisis le mot qui correspond. Tu peux essayer une deuxième fois.</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={async () => { if (await verify()) setSession(createSession(questions)); }}><Text style={styles.buttonText}>C’est parti !</Text></Pressable>
      </> : session.finished ? <>
        <Text accessibilityRole="header" style={styles.title}>Bravo pour tes efforts !</Text>
        <Text style={styles.body}>Tu as exploré {summary.completed} mots. Chaque essai t’aide à apprendre.</Text>
        <Text style={styles.body}>{summary.incorrectAfterTwoAttempts ? 'Certains mots se découvrent petit à petit. Tu pourras les revoir tranquillement.' : 'Tu as trouvé tous les mots, parfois avec un deuxième essai. Continue comme ça !'}</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={async () => { if (await verify()) setSession(createSession(questions)); }}><Text style={styles.buttonText}>Rejouer</Text></Pressable>
      </> : <VocabularyQuestion key={question.id} question={resolveVocabularyQuestion(question, assignment)} response={session.responses[question.id]}
        number={session.index + 1} total={questions.length}
        onSubmit={async selected => { if (await verify()) setSession(current => current ? submitAnswer(current, question, selected) : current); }}
        onNext={async () => { if (await verify()) setSession(current => current ? advanceSession(current, question.id) : current); }} />}
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
