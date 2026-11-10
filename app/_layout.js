import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: '#174b3e' }}>
      <Stack.Screen name="index" options={{ title: 'Accueil' }} />
      <Stack.Screen name="practice" options={{ title: 'Entraînement' }} />
    </Stack>
  );
}
