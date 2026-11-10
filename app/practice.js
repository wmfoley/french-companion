import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import Screen from '../src/components/Screen';

export default function PracticeScreen() {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>Bientôt, tes exercices</Text>
      <Text style={styles.body}>Les activités de français arrivent bientôt.</Text>
      <Link href="/" style={styles.link}>Retour à l’accueil</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#174b3e' },
  body: { fontSize: 20, lineHeight: 30, color: '#243b33' },
  link: { fontSize: 20, paddingVertical: 16, minHeight: 48, color: '#174b3e', textDecorationLine: 'underline' },
});
