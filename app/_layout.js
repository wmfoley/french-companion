import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: '#174b3e' }}>
      <Stack.Screen name="index" options={{ title: 'Accueil' }} />
      <Stack.Screen name="assignments" options={{ title: 'Mes leçons' }} />
      <Stack.Screen name="add-assignment" options={{ title: 'Add New Assignment' }} />
      <Stack.Screen name="grades" options={{ title: 'My Progress' }} />
      <Stack.Screen name="practice" options={{ title: 'Entraînement' }} />
      <Stack.Screen name="parent" options={{ title: 'Parent Area' }} />
      <Stack.Screen name="native-pbkdf2" options={{ title: 'Native development proof' }} />
    </Stack>
  );
}
