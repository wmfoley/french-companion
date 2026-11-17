import { Platform, Text } from 'react-native';

export default function CaptureProofRoute() {
  if (__DEV__ && Platform.OS === 'android') {
    const Proof = require('../src/components/CaptureProof').default;
    return <Proof />;
  }
  return <Text>Capture comparison is available only in the Android development app.</Text>;
}
