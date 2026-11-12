import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type Car = { address: string; name: string };

type CarTriggerNative = {
  getCar(): Car | null;
  pairCar(): Promise<Car>;
  forgetCar(): void;
  testAnnounce(delaySeconds: number): void;
};

// Android-only module; null on iOS/web so callers can hide the car UI.
export const CarTrigger =
  Platform.OS === 'android' ? requireOptionalNativeModule<CarTriggerNative>('CarTrigger') : null;

/** Must match AnnounceService.TASK_KEY on the Kotlin side. */
export const ANNOUNCE_TASK = 'TollAnnounce';
