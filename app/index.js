import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import Screen from '../src/components/Screen';

export default function HomeScreen() {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>Bienvenue !</Text>
      <Text style={styles.body}>Un petit moment pour pratiquer le français.</Text>
      <Link href="/practice" style={styles.link}>Commencer à pratiquer</Link>
      {__DEV__ && <Link href="/practice?mode=demo" style={styles.demo}>Démo — contenu en attente de validation</Link>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '700', color: '#174b3e' },
  body: { fontSize: 20, lineHeight: 30, color: '#243b33' },
  link: { fontSize: 20, padding: 16, minHeight: 48, color: '#ffffff', backgroundColor: '#174b3e', borderRadius: 12 },
  demo: { fontSize: 18, paddingVertical: 16, minHeight: 48, color: '#174b3e', textDecorationLine: 'underline' },
});
