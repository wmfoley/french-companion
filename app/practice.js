import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppState, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import VocabularyQuestion from '../src/components/VocabularyQuestion';
import TypedVocabularyQuestion from '../src/components/TypedVocabularyQuestion';
import referenceAssignment from '../src/content/fixtures/grade4-reference.json';
import { normalizeAssignment } from '../src/core/assignments/normalizeAssignment';
import { generateVocabularyQuestions, resolveVocabularyQuestion } from '../src/core/exercises/vocabularyMultipleChoice';
import { generateTypedVocabularyQuestions } from '../src/core/exercises/typedVocabularyRecall';
import { summarizeSession } from '../src/core/sessions/practiceSession';
import { createPracticeRun } from '../src/core/sessions/practiceRun';
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
  const visit = useRef(0);
  const baseline = useRef(null);
  const verify = useCallback(async () => {
    const checkingVisit = visit.current;
    try {
      const latest = await localHousehold.readPractice(assignmentId);
      if (!latest.eligibility.eligible || latest.document.contentRevision !== baseline.current) throw new Error('Cette leçon n’est plus disponible avec la politique actuelle du foyer.');
      if (active.current && checkingVisit === visit.current) return true;
    } catch { if (active.current && checkingVisit === visit.current) setError('La pratique est en pause. La politique du foyer a changé ou les données locales sont indisponibles.'); }
    return false;
  }, [assignmentId]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && assignmentId && baseline.current) verify(); });
    return () => listener.remove();
  }, [assignmentId, verify]);
  useFocusEffect(useCallback(() => {
    active.current = true;
    const loadingVisit = ++visit.current;
    const current = () => active.current && loadingVisit === visit.current;
    setError(''); setContent(null);
    async function load() {
      try {
        if (!assignmentId) {
          const list = await localHousehold.listPracticeAssignments();
          if (current()) setAssignments(list);
          return;
        }
        const result = await localHousehold.readPractice(assignmentId);
        if (!current()) return;
        if (!result.eligibility.eligible) throw new Error('Cette leçon attend une autorisation selon la politique du foyer.');
        baseline.current = result.document.contentRevision;
        if (current()) setContent({ document: result.document, policy: result.policy, assignment: result.document.assignment,
          purpose: result.document.purpose, eligibility: result.eligibility });
      } catch (failure) { if (current()) setError(failure.message); }
    }
    load();
    const timer = setInterval(() => { if (assignmentId && baseline.current) verify(); }, 2000);
    return () => { active.current = false; visit.current++; baseline.current = null; clearInterval(timer); setContent(null); };
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
    return { assignment, document: { storageVersion: 1, contentRevision: 1, purpose: 'household_assignment', assignment, approval: null } };
  });
  const [exerciseType, setExerciseType] = useState('vocabulary_multiple_choice');
  return <ExercisePractice key={exerciseType} demo={demo} content={content} exerciseType={exerciseType} onChoose={setExerciseType} verify={verify} />;
}

function ExercisePractice({ demo, content, exerciseType, onChoose, verify }) {
  const spelling = exerciseType === 'typed_vocabulary_recall';
  const [options] = useState(() => ({ mode: demo ? 'demo' : 'practice', development: __DEV__, householdPolicy: content.policy }));
  const [generated] = useState(() => spelling ? generateTypedVocabularyQuestions(content.document, options) :
    generateVocabularyQuestions(content.assignment, { ...options, approval: content.document.approval,
      contentRevision: content.document.contentRevision, purpose: content.document.purpose }));
  const [run, setRun] = useState(null);
  const [ready, setReady] = useState(false);
  const [controls] = useState(() => createPracticeRun({ questions: generated.questions, verify, random: Math.random, onChange: setRun,
    exerciseType, document: content.document, options }));
  useFocusEffect(useCallback(() => {
    controls.enter();
    setReady(true);
    return () => { controls.leave(); setReady(false); setRun(null); };
  }, [controls]));
  const session = run?.session;
  const assignment = content.assignment;
  const questions = run?.questions || generated.questions;
  const question = session && !session.finished ? questions[session.index] : null;
  const summary = session ? summarizeSession(session) : null;
  const body = (
    <Screen keyboardShouldPersistTaps={spelling ? 'handled' : 'never'}>
      {demo && <Text accessibilityRole="header" style={styles.banner}>Démo — contenu en attente de validation</Text>}
      {content.purpose === 'development_sample' && <Text style={styles.banner}>Exemple de développement — ne constitue pas une leçon approuvée</Text>}
      {content.eligibility?.requiresUnreviewedNotice && <Text style={styles.banner}>Cette leçon n’a pas encore été vérifiée par un parent.</Text>}
      {(!session || session.finished) && <View accessibilityLabel="Activité" style={styles.choices}>
        {[['vocabulary_multiple_choice', 'Multiple Choice'], ['typed_vocabulary_recall', 'Spelling Practice']].map(([type, label]) => <Pressable key={type}
          accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: exerciseType === type }}
          {...(Platform.OS === 'web' ? { 'aria-pressed': exerciseType === type } : {})} onPress={() => onChoose(type)}
          style={[styles.choice, exerciseType === type && styles.chosen]}><Text style={styles.body}>{label}</Text></Pressable>)}
      </View>}
      {!questions.length ? <>
        <Text accessibilityRole="header" style={styles.title}>Ta leçon se prépare</Text>
        <Text style={styles.body}>{spelling ? 'Aucun terme avec une définition utilisable pour cette activité. Tu peux choisir une autre activité.' : assignment.reviewStatus !== 'approved' && !demo ? 'Cette leçon attend la validation d’un parent avant de commencer.' : 'Il faut au moins trois mots avec des définitions différentes pour cette activité.'}</Text>
      </> : !session ? <>
        <Text accessibilityRole="header" style={styles.title}>{spelling ? 'Pratiquons l’orthographe !' : 'Jouons avec les mots !'}</Text>
        <Text style={styles.body}>{spelling ? 'Lis la définition et écris le terme complet, avec son article (un, une, le, la) s’il en a un. Tu peux corriger ta réponse après un premier essai.' : 'Lis une définition et choisis le mot qui correspond. Tu peux essayer une deuxième fois.'}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} style={styles.button} onPress={() => controls.start()}><Text style={styles.buttonText}>C’est parti !</Text></Pressable>
      </> : session.finished ? <>
        <Text accessibilityRole="header" style={styles.title}>Bravo pour tes efforts !</Text>
        <Text style={styles.body}>Tu as exploré {summary.completed} mots. Chaque essai t’aide à apprendre.</Text>
        <Text style={styles.body}>{summary.incorrectAfterTwoAttempts ? 'Certains mots se découvrent petit à petit. Tu pourras les revoir tranquillement.' : 'Tu as trouvé tous les mots, parfois avec un deuxième essai. Continue comme ça !'}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} style={styles.button} onPress={() => controls.start()}><Text style={styles.buttonText}>Rejouer</Text></Pressable>
      </> : spelling ? <TypedVocabularyQuestion key={question.id} question={controls.present(run, question)} response={session.responses[question.id]}
        number={session.index + 1} total={questions.length}
        onSubmit={text => controls.submit(run, question, text)} onNext={() => controls.advance(run, question.id)} /> :
      <VocabularyQuestion key={question.id} question={resolveVocabularyQuestion(question, assignment)} response={session.responses[question.id]}
        number={session.index + 1} total={questions.length}
        onSubmit={selected => controls.submit(run, question, selected)}
        onNext={() => controls.advance(run, question.id)} />}
      <Link href="/" style={styles.link}>Retour à l’accueil</Link>
    </Screen>
  );
  return spelling ? <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{body}</KeyboardAvoidingView> : body;
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 }, choices: { gap: 12 }, choice: { minHeight: 56, padding: 16, borderWidth: 2, borderColor: '#789384', borderRadius: 12 },
  chosen: { backgroundColor: '#e0efe5', borderColor: '#174b3e' },
  title: { fontSize: 28, fontWeight: '700', color: '#174b3e' },
  body: { fontSize: 20, lineHeight: 30, color: '#243b33' },
  banner: { fontSize: 18, lineHeight: 28, padding: 16, borderWidth: 2, borderColor: '#81621b', borderRadius: 8, backgroundColor: '#fff3cb', color: '#59420d' },
  link: { fontSize: 20, paddingVertical: 16, minHeight: 48, color: '#174b3e', textDecorationLine: 'underline' },
  button: { padding: 18, minHeight: 56, borderRadius: 12, backgroundColor: '#174b3e' },
  buttonText: { fontSize: 20, fontWeight: '600', color: '#ffffff', textAlign: 'center' },
});
