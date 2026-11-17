import { Link } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';

export default function HomeScreen() {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>Bienvenue !</Text>
      <Text style={styles.body}>Un petit moment pour pratiquer le français.</Text>
      <Link testID="home-study" href="/assignments" style={styles.link}>Study an Assignment</Link>
      <Link testID="home-add" href="/add-assignment" style={styles.link}>Add New Assignment</Link>
      <Link href="/grades" style={styles.demo}>My Progress</Link>
      <Link href="/parent" style={styles.demo}>Parent Area</Link>
      {__DEV__ && <View style={styles.development}>
        <Text style={styles.small}>Développement</Text>
        <Link href="/practice?mode=demo" style={styles.smallLink}>Démo — contenu en attente de validation</Link>
        {Platform.OS === 'android' && <Link href="/native-pbkdf2" style={styles.smallLink}>Native PBKDF2 development proof</Link>}
        {Platform.OS === 'android' && <Link href="/capture-proof" style={styles.smallLink}>Capture technology comparison</Link>}
      </View>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '700', color: '#174b3e' },
  body: { fontSize: 20, lineHeight: 30, color: '#243b33' },
  link: { fontSize: 20, padding: 16, minHeight: 48, color: '#ffffff', backgroundColor: '#174b3e', borderRadius: 12 },
  demo: { fontSize: 18, paddingVertical: 16, minHeight: 48, color: '#174b3e', textDecorationLine: 'underline' },
  development: { gap: 8, borderTopWidth: 1, borderColor: '#789384', paddingTop: 16 },
  small: { fontSize: 16, color: '#243b33' },
  smallLink: { fontSize: 16, paddingVertical: 14, minHeight: 48, color: '#174b3e', textDecorationLine: 'underline' },
});
