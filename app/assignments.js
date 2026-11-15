import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { localHousehold } from '../src/services/localHousehold';
import { createStudentAssignmentList } from '../src/services/studentAssignmentList';

export default function AssignmentsScreen() {
  const [list] = useState(() => createStudentAssignmentList({ service: localHousehold }));
  const state = useSyncExternalStore(list.subscribe, list.snapshot, list.snapshot);
  useFocusEffect(useCallback(() => { list.enter(); return () => list.leave(); }, [list]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => { if (next === 'active') list.refresh(); else list.pause(); });
    const visibility = () => { if (document.visibilityState === 'visible') list.refresh(); else list.pause(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    return () => { listener.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility); };
  }, [list]);
  return <Screen>
    <Text accessibilityRole="header" style={styles.title}>Mes leçons</Text>
    <Text style={styles.body}>Choisis une leçon pour pratiquer à ton rythme.</Text>
    {state.status === 'loading' && <Text accessibilityLiveRegion="polite" style={styles.body}>Chargement des leçons…</Text>}
    {state.status === 'error' && <View style={styles.card}>
      <Text accessibilityLiveRegion="polite" style={styles.body}>Impossible de lire les leçons sur cet appareil. Réessaie ou demande de l’aide à un parent.</Text>
      <Pressable accessibilityRole="button" onPress={() => list.refresh()} style={styles.retry}><Text style={styles.body}>Réessayer</Text></Pressable>
    </View>}
    {state.status === 'ready' && !state.items.length && <Text style={styles.body}>Aucune leçon enregistrée pour le moment. Tu pourras ajouter une leçon quand la capture sera disponible.</Text>}
    {state.items.map(item => <View key={item.id} style={styles.card}>
      {item.eligible ? <Link href={{ pathname: '/practice', params: { assignmentId: item.id } }} style={styles.link}>{item.title}</Link>
        : <Text style={styles.body}>{item.title}</Text>}
      <Text style={styles.body}>{item.explanation}</Text>
    </View>)}
    <Link href="/" style={styles.link}>Retour à l’accueil</Link>
  </Screen>;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#174b3e' },
  body: { fontSize: 20, lineHeight: 30, color: '#243b33' },
  card: { padding: 16, gap: 8, borderWidth: 1, borderColor: '#789384', borderRadius: 12, backgroundColor: '#fff' },
  link: { fontSize: 20, paddingVertical: 16, minHeight: 48, color: '#174b3e', textDecorationLine: 'underline' },
  retry: { padding: 12, minHeight: 48, borderWidth: 1, borderColor: '#174b3e', borderRadius: 8 },
});
