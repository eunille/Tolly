import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op, so fall back to the browser's alert there.
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
