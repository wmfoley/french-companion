import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import Screen from '../src/components/Screen';

export default function AddAssignmentScreen() {
  return <Screen>
    <Text accessibilityRole="header" style={styles.title}>Add New Assignment</Text>
    <Text style={styles.body}>Bientôt, tu pourras photographier une nouvelle leçon. La capture avec la caméra n’est pas encore disponible.</Text>
    <Link href="/" style={styles.link}>Retour à l’accueil</Link>
  </Screen>;
}
const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#174b3e' },
  body: { fontSize: 20, lineHeight: 30, color: '#243b33' },
  link: { fontSize: 20, paddingVertical: 16, minHeight: 48, color: '#174b3e', textDecorationLine: 'underline' },
});
