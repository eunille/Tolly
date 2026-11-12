import { PermissionsAndroid, Platform, type Permission } from 'react-native';
import { CarTrigger, type Car } from '../../../modules/car-trigger';

/** Asks for Bluetooth (+ notification) permission, then shows Android's own car picker. */
export async function pairCarWithPermissions(): Promise<Car | null> {
  if (!CarTrigger) return null;
  const { BLUETOOTH_CONNECT, POST_NOTIFICATIONS } = PermissionsAndroid.PERMISSIONS;
  const wanted: Permission[] = [];
  if (Number(Platform.Version) >= 31) wanted.push(BLUETOOTH_CONNECT);
  if (Number(Platform.Version) >= 33) wanted.push(POST_NOTIFICATIONS);
  if (wanted.length) {
    const res = await PermissionsAndroid.requestMultiple(wanted);
    if (wanted.includes(BLUETOOTH_CONNECT) && res[BLUETOOTH_CONNECT] !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Bluetooth permission is needed to notice when your car connects.');
    }
  }
  return CarTrigger.pairCar();
}
