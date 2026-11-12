// Custom entry: register the headless task the Android car trigger runs, then load the router.
import { AppRegistry, Platform } from 'react-native';
import { ANNOUNCE_TASK } from './modules/car-trigger';
import { announceTask } from './src/features/car-trigger/task';

// Android-only: iOS uses the Swift App Intent instead, and react-native-web has no headless tasks.
if (Platform.OS === 'android') AppRegistry.registerHeadlessTask(ANNOUNCE_TASK, () => announceTask);

import 'expo-router/entry';
