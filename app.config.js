// Keep the original Expo Go/web identity unless the development variant is explicit.
module.exports = ({ config }) => {
  const development = process.env.APP_VARIANT === 'development';
  if (!development) return config;
  return {
    ...config,
    name: 'French Companion Dev',
    scheme: 'french-companion-dev',
    android: { ...config.android, package: 'com.frenchcompanion.dev' },
    plugins: [...(config.plugins || []).filter(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-dev-client'),
      ['expo-dev-client', { addGeneratedScheme: false }]],
  };
};
