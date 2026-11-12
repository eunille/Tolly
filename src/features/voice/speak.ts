import * as Speech from 'expo-speech';

export type SpeakHooks = { onStart?: () => void };
export type VoiceStatus = { state: 'idle' | 'loading' | 'ready' | 'failed'; progress: number };
export type VoiceChoice = { id: string; label: string; detail: string };

// Phones use the best installed system voice for now, so there's nothing to pick.
// (On-device Kokoro / Phonon for phones is the next step; see SPIKE.md.)
export const voiceChoices: VoiceChoice[] = [];
export const getVoiceChoice = async (): Promise<string | null> => null;
export async function setVoiceChoice(_id: string): Promise<void> {}

const MAX_MS = 30_000;

let voice: string | null | undefined; // undefined = not looked up yet

/**
 * Prefer an installed "enhanced" (neural) English voice: much less robotic than the default.
 * ponytail: system voices for now; on-device Kokoro (react-native-executorch) is the planned upgrade
 * once the first phone build works.
 */
async function naturalVoice(): Promise<string | null> {
  if (voice !== undefined) return voice;
  try {
    const english = (await Speech.getAvailableVoicesAsync()).filter((v) => /^en[-_]/i.test(v.language));
    const enhanced = english.filter((v) => v.quality === Speech.VoiceQuality.Enhanced);
    voice = (enhanced.find((v) => /PH|US|GB|AU/i.test(v.language)) ?? enhanced[0])?.identifier ?? null;
  } catch {
    voice = null;
  }
  return voice;
}

/** Resolves when speech ends, fails or is stopped; never hangs the headless task if TTS goes silent. */
export async function speak(text: string, hooks: SpeakHooks = {}): Promise<void> {
  const v = await naturalVoice();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, MAX_MS);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    Speech.speak(text, { voice: v ?? undefined, onStart: hooks.onStart, onDone: done, onError: done, onStopped: done });
  });
}

export const stopSpeaking = () => Speech.stop();

/** System voices start instantly; nothing to warm up on phones. (The web voices cache; see speak.web.ts.) */
export async function prewarm(_text: string): Promise<void> {}

/** Native voices are built in, so they're always ready. (The web preview downloads Kokoro; see speak.web.ts.) */
export function onVoiceStatus(fn: (s: VoiceStatus) => void): () => void {
  fn({ state: 'ready', progress: 1 });
  return () => {};
}
