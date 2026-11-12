import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics don't exist on web; never let a buzz failure break a tap.
export function tap(style: 'light' | 'medium' = 'light') {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(style === 'light' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function success() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
