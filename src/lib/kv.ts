import * as SecureStore from 'expo-secure-store';

// All app state lives in the Keychain (iOS) / Keystore (Android) under one service, readable after
// first unlock, so the iOS Siri intent (app-intents/TollStore.swift) can read and update the same
// items while the phone is locked in the car. Change these options only together with TollStore.swift.
const opts: SecureStore.SecureStoreOptions = {
  keychainService: 'toll',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const kvGet = (key: string) => SecureStore.getItemAsync(key, opts);
export const kvSet = (key: string, value: string) => SecureStore.setItemAsync(key, value, opts);
export const kvDelete = (key: string) => SecureStore.deleteItemAsync(key, opts);
