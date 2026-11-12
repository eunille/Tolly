# Phase 0 spike: findings and test steps

Nov 12, 2026. Goal: prove the three risky on-device pieces before building the app.

## What we learned (desk research)

| Question | Answer |
| --- | --- |
| Can the phone fetch **Autosweep**? | Yes, with the user's customer-portal login. `POST autosweeprfidapps.com/api/v3/portalnew/index.php`, form field `tag=login` (email, password), then `tag=checkbalance` (account_number) → `data.available_balance`. No CAPTCHA. Session is a cookie. |
| Can the phone fetch **Easytrip**? | Not cleanly. The Quick Balance Inquiry (`escquickbalanceinquiry.com/QBI/Api/GetBalance`) needs reCAPTCHA v3 **and** v2 tokens. We do not bypass it. Official options: their page, SMS `BAL <acct>` to 09191601553 (₱1), MPT DriveHub app (no public API). |
| Terms of use? | Neither the Autosweep T&C PDF nor the Easytrip T&C has a clause on automated access. Easytrip's CAPTCHA is the real "no bots" signal. |
| Don't touch | Autosweep's `tag=checkaccountams` answers without login. Looks unintended; using it would read accounts without their owner signing in. |
| Lockout risk | The Autosweep portal locks accounts after repeated failed logins. The app stops auto-login after one rejection until the user re-enters the password. |

**Decision taken:** Autosweep live; Easytrip semi-manual (open official page / SMS, user types the balance, voice reads it with its age). Pursue an official MPT (Easytrip) partnership in parallel.

## What's built

- `src/providers/autosweep/`: client + parser (+ tests). Parser throws instead of defaulting to ₱0.
- `src/providers/easytrip/fallback.ts`: copy number + open official page; prefilled SMS.
- `src/features/voice/`: announcement text ("Easytrip: 150 pesos, as of 2 hours ago. Low, reload soon.") + TTS.
- `modules/car-trigger/` (Android, Kotlin):
  1. **Pair car** via CompanionDeviceManager (system picker). The association is what lets us start a foreground service from the background (`REQUEST_COMPANION_RUN_IN_BACKGROUND`).
  2. `ACL_CONNECTED` manifest receiver: when the paired car's Bluetooth connects (2-min debounce), it starts `AnnounceService`.
  3. `AnnounceService` (foreground, type `connectedDevice`) runs the JS headless task `TollAnnounce`: refresh, then speak.
- `app-intents/` (iOS, Swift via `expo-app-intents`, alpha): a **Get Toll Balances** App Intent that runs without opening the app, checks Autosweep live, reads the saved Easytrip balance and returns the spoken text. Siri phrases: "Check toll balances in Toll Balance". iPhones can't watch Bluetooth from an app, so the car trigger is a Shortcuts automation: *Bluetooth → car → Run Immediately → Get Toll Balances → Speak Text*. The Swift duplicates the JS client + announcement (JS side has the tests; keep them in sync).
- `src/lib/kv.ts`: all state in Keychain/Keystore (service `toll`, readable after first unlock) so the Swift intent shares it. `kv.web.ts` uses localStorage for the browser preview only.
- `src/app/index.tsx`: one plain spike screen to drive all of it.

## Voice

**Hands-free "Tolly"** (`src/features/voice/useHandsFree.ts`, `commands.ts`): tap the mic chip once, then say "Tolly" → hello → "balances" / "stop" / "settings". "Tolly, check my balance" in one breath skips the hello. Uses `expo-speech-recognition` on all platforms (on-device on phones that support it; Chrome on web uses Google's servers). Web test timings with simulated speech: hello 0.7 s (pre-made), balances 2.3 s, stop instant.
- Limits: iPhone listens only while the app is open; Android keeps listening while open with the mic indicator; browsers need one tap per visit before audio can play.

Underdog Woof was tried and removed: non-commercial licence (paid release needs a commercial licence) and only a Python runtime.

- Web preview: **Phonon 31m** (`phonon-tts`, Apache-2.0) by default, or **Kokoro-82M** (`kokoro-js`, voice `af_heart`), runs locally in WebAssembly. First use downloads ~90 MB (cached after); took ~28 s incl. download in testing. Falls back to the browser voice.
- Phones today: the best installed *enhanced* (neural) system voice. iPhone car/Siri path speaks with Siri's voice.
- Next: on-device Kokoro on phones via `react-native-executorch` (ships Kokoro, CoreML on iOS / XNNPACK on Android; needs `react-native-audio-api` for playback). Use it for the in-app Speak button first; the background car trigger should keep a system voice fallback because model load takes seconds and iOS runs that path in Swift.

## Web preview

`npx expo start --web` → http://localhost:8081. Good for checking the screens and the Easytrip/announcement flow. Autosweep shows "unavailable" in the browser: its API sends no CORS allow-origin header, so browsers block it (the phone apps aren't affected). Car trigger and Siri don't exist on web.

## Builds (EAS, project @catalyxsolutions/toll-app)

Nov 12, 2026, both green on the first try (first real compile of the Kotlin car module):
- **Preview** (standalone, share this one): https://expo.dev/accounts/catalyxsolutions/projects/toll-app/builds/a1da654a-e918-473d-a8e8-5c3cb0bba39d
- **Development** (loads JS from `npx expo start --dev-client` on the same Wi-Fi): https://expo.dev/accounts/catalyxsolutions/projects/toll-app/builds/89adb46a-6782-48b7-8486-094149a9081f

Rebuild: `npx eas-cli@latest build -p android --profile preview` (or `development`). Signing key is stored on EAS.

## Run it on your phone

Needs: an Expo account, an Android 13+ phone, a car (or any Bluetooth speaker/headset) to pair.

```powershell
cd toll-app
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # cloud build, ~15 min; install the APK from the link/QR
npx expo start --dev-client                                           # then open the app on the phone
```

Optional: capture real Autosweep replies for the parser test (logs in once; personal fields redacted):

```powershell
$env:ASW_EMAIL="you@example.com"; $env:ASW_PASSWORD="..."; npm run capture:autosweep; npm test
```

## Test checklist (record results in the table)

| # | Test | How | Pass when |
| --- | --- | --- | --- |
| 1 | Autosweep live | Save portal login → "Refresh and speak now" | Speaks the same balance the portal shows |
| 2 | Wrong password guard | Save a wrong password → refresh twice | Warning shows; second refresh makes no login attempt |
| 3 | Easytrip manual | Save account no. → open page / SMS → type balance → refresh | Speaks it; an hour later says "as of 1 hour ago" |
| 4 | Offline | Airplane mode → refresh | Speaks cached Autosweep balance with its age |
| 5 | Screen-off speech | Pair car → "Test with screen off" → lock phone | Speaks within ~15 s with the screen off |
| 6 | Real car trigger | Kill app from recents, lock phone, start car | Speaks within ~10 s of Bluetooth connecting |
| 7 | After reboot | Reboot phone, don't open app, start car | Speaks |
| 8 | OEM killers | Repeat 6 on Xiaomi / Oppo / Vivo / Samsung | Note which brands need the battery-optimisation exemption |

| 9 | iPhone Siri | "Hey Siri, check toll balances in Toll Balance" | Siri speaks both balances |
| 10 | iPhone car | Set up the Bluetooth automation, lock phone, start car | Speaks without unlocking |

If 6 fails, check `adb logcat -s CarTrigger ReactNativeJS` for `Could not start AnnounceService from background`.

## Known gaps (on purpose for a spike)

- Android 13+ only for pairing.
- iOS: Swift not compiled yet (needs a Mac, or `eas build -p ios` with a paid Apple Developer account). User must set up the Shortcuts automation once.
- Autosweep: main account only (sub-accounts via `getsubaccounts` later); logs in on every refresh.
- English voice only; fixed ₱200 low-balance threshold.
- Kotlin was not compiled locally (no JDK/Android SDK on this PC); the EAS build is the first compile.
- App id `com.catalyx.tollbalance` and name "Toll Balance" are placeholders.

## Results

| # | Phone / Android | Result | Notes |
| --- | --- | --- | --- |
| | | | |
