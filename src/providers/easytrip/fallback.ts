import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

// Easytrip's Quick Balance Inquiry requires reCAPTCHA (v3 + v2), so we don't automate it:
// the user checks on the official page or by SMS, then types the balance they saw into the app.
const QBI_URL = 'https://www.escquickbalanceinquiry.com/QBI';
const SMS_NUMBER = '09191601553'; // official: "BAL <12-digit account>", ₱1 per inquiry

export const isEasytripAccountNumber = (s: string) => /^\d{12}$/.test(s);

/** Copies the account number (the page wants it typed) and opens the official page in-app. */
export async function openEasytripBalancePage(accountNumber: string) {
  await Clipboard.setStringAsync(accountNumber);
  await WebBrowser.openBrowserAsync(QBI_URL);
}

/** Opens the SMS app prefilled; the user taps Send. Apps can't send SMS silently on Play Store builds. */
export function smsEasytripBalance(accountNumber: string) {
  return Linking.openURL(`sms:${SMS_NUMBER}?body=${encodeURIComponent(`BAL ${accountNumber}`)}`);
}
