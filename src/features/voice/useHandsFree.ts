import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { hearWake, parseCommand, type Command } from '@/features/voice/commands';

export type ListenState = 'off' | 'sleeping' | 'awake' | 'denied' | 'unsupported';

const AWAKE_MS = 8_000; // after "Tolly", how long to wait for a command
const AFTER_SPEECH_MS = 700; // ignore the tail of Tolly's own voice picked up by the mic

/**
 * Hands-free voice: listens for "Tolly", then for a command. Same code on iOS, Android and web
 * (expo-speech-recognition wraps each platform's recogniser). On-device recognition when the
 * phone supports it; Chrome on web sends audio to Google for transcription.
 */
export function useHandsFree({
  onWake,
  onCommand,
}: {
  onWake: () => void;
  onCommand: (c: Command) => void;
}) {
  const [state, setState] = useState<ListenState>('off');
  const wanted = useRef(false);
  const awakeUntil = useRef(0);
  const muteUntil = useRef(0);
  const handled = useRef(false); // one action per utterance, even as interim results keep arriving
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef({ onWake, onCommand });
  const startRef = useRef<() => Promise<void>>(async () => {});
  const armRef = useRef<() => void>(() => {});

  useEffect(() => {
    handlers.current = { onWake, onCommand };
  });

  useEffect(() => {
    function restart() {
      if (!wanted.current) return;
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true, // react on partial words: "Tolly" fires before the sentence ends
        continuous: true,
        contextualStrings: ['Tolly', 'balances', 'Autosweep', 'Easytrip'],
        requiresOnDeviceRecognition: Platform.OS !== 'web' && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
        iosVoiceProcessingEnabled: true, // echo cancellation so Tolly doesn't hear itself
      });
    }

    function goToSleep() {
      awakeUntil.current = 0;
      if (wanted.current) setState('sleeping');
    }

    // `handled` swallows the rest of an utterance we already acted on (interim results keep arriving).
    // If we acted on its final result, the utterance is over, so don't swallow the next one.
    function act(c: Command, final: boolean) {
      handled.current = !final;
      goToSleep();
      handlers.current.onCommand(c);
    }

    function heard(text: string, final: boolean) {
      if (!wanted.current) return;
      if (handled.current) {
        if (final) handled.current = false;
        return;
      }
      const now = Date.now();
      if (now < muteUntil.current) {
        // While Tolly talks, only "stop" gets through (its own words never contain it).
        if (parseCommand(text) === 'stop') act('stop', final);
        return;
      }
      if (now < awakeUntil.current) {
        const c = parseCommand(text);
        if (c) act(c, final);
        return;
      }
      const w = hearWake(text);
      if (!w.wake) return;
      const c = parseCommand(w.rest);
      if (c) return act(c, final); // "Tolly, check my balance": skip the hello
      handled.current = !final;
      arm();
      setState('awake');
      handlers.current.onWake();
    }

    /** Open (or re-open) the command window. Re-armed when Tolly finishes talking, so a slow hello can't eat it. */
    function arm() {
      awakeUntil.current = Date.now() + AWAKE_MS;
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
      sleepTimer.current = setTimeout(() => Date.now() >= awakeUntil.current && goToSleep(), AWAKE_MS + 100);
    }
    armRef.current = arm;

    const subs = [
      ExpoSpeechRecognitionModule.addListener('result', (e) => heard(e.results[0]?.transcript ?? '', e.isFinal)),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        handled.current = false;
        if (wanted.current) setTimeout(restart, 250); // recognisers stop after silence; keep listening
      }),
      ExpoSpeechRecognitionModule.addListener('error', (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          wanted.current = false;
          setState('denied');
        }
      }),
    ];

    // Dev-only hook so the flow can be tested in a browser with no microphone.
    if (__DEV__ && Platform.OS === 'web') {
      (globalThis as { __tollyHear?: (t: string, f?: boolean) => void }).__tollyHear = (t, f = true) => heard(t, f);
    }

    startRef.current = async () => {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return setState('unsupported');
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return setState('denied');
      wanted.current = true;
      setState('sleeping');
      restart();
    };

    return () => {
      subs.forEach((s) => s.remove());
      wanted.current = false;
      ExpoSpeechRecognitionModule.abort();
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
    };
  }, []);

  return {
    state,
    async enable() {
      await startRef.current();
    },
    disable() {
      wanted.current = false;
      ExpoSpeechRecognitionModule.abort();
      setState('off');
    },
    /**
     * Call with true while Tolly is talking so it doesn't hear itself. `tailMs` covers the echo after
     * speech ends naturally; pass 0 when speech was cut off (nothing left to echo).
     */
    setSpeaking(speaking: boolean, tailMs = AFTER_SPEECH_MS) {
      muteUntil.current = speaking ? Number.POSITIVE_INFINITY : Date.now() + tailMs;
      if (!speaking && awakeUntil.current > 0) armRef.current(); // still awake: the window starts now
    },
  };
}
