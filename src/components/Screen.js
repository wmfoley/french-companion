import { Platform, ScrollView, StyleSheet, View } from 'react-native';

export default function Screen({ children, onInteraction }) {
  return (
    <ScrollView contentContainerStyle={styles.page} onTouchStart={onInteraction} onScrollBeginDrag={onInteraction}
      {...(Platform.OS === 'web' && onInteraction ? { onPointerDownCapture: onInteraction, onKeyDownCapture: onInteraction } : {})}>
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#f5f8f3', padding: 24 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 24 },
});
