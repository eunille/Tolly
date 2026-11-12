// Home: balances on top, the voice stage below. Settings live in a drawer.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BalanceTile } from '@/features/balances/BalanceCard';
import { cachedReadings, refreshAll } from '@/features/balances/refresh';
import { SettingsDrawer, type Tab } from '@/features/settings/SettingsDrawer';
import { ago, buildAnnouncement, LOW_BALANCE, type Reading } from '@/features/voice/announcement';
import { onVoiceStatus, prewarm, speak, stopSpeaking, type VoiceStatus } from '@/features/voice/speak';
import { useHandsFree } from '@/features/voice/useHandsFree';
import { VoiceStage, type Phase } from '@/features/voice/VoiceStage';
import { getAutosweepCreds, getEasytripAccount, isHandsFreeOn, isSetupDone, setHandsFreeOn } from '@/lib/storage';
import { success, tap } from '@/shared/haptics';
import { colors, fonts, radius } from '@/shared/theme';
import { nowMs } from '@/shared/time';
import { ChunkyButton } from '@/shared/ui/ChunkyButton';
import { Confetti } from '@/shared/ui/Confetti';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Sheet } from '@/shared/ui/Sheet';

const HELLO = 'Hi! Want your balances?';

export default function Home() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ speak?: string }>();
  const speakRun = useRef(0);
  const autoSpoke = useRef(false);

  const [readings, setReadings] = useState<Reading[]>([]);
  const [now, setNow] = useState(nowMs);
  const [updating, setUpdating] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [voice, setVoice] = useState<VoiceStatus>({ state: 'idle', progress: 0 });
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState<Tab>('autosweep');
  const [confetti, setConfetti] = useState(0);

  async function refresh(): Promise<Reading[]> {
    setUpdating(true);
    try {
      const fresh = await refreshAll();
      setReadings(fresh);
      setUpdatedAt(nowMs());
      setNow(nowMs());
      return fresh;
    } finally {
      setUpdating(false);
    }
  }

  const hands = useHandsFree({
    onWake: () => void greet(),
    onCommand: (c) => {
      if (c === 'stop') void stopNow();
      else if (c === 'settings') openDrawer('autosweep');
      else void speakBalances();
    },
  });

  async function stopNow() {
    speakRun.current++;
    await stopSpeaking();
    hands.setSpeaking(false, 0); // cut off mid-word: no echo tail to ignore
    setPhase('idle');
  }

  /** Speak while muting the wake-word listener so Tolly never hears itself. */
  async function say(text: string, run: number) {
    hands.setSpeaking(true);
    try {
      setTranscript(text);
      await speak(text, { onStart: () => run === speakRun.current && setPhase('speaking') });
    } finally {
      // Finished naturally: ignore the echo tail. Interrupted (run moved on): nothing to echo.
      hands.setSpeaking(false, run === speakRun.current ? undefined : 0);
    }
  }

  async function speakBalances() {
    if (phase !== 'idle') await stopNow();
    const run = ++speakRun.current;
    tap('medium');
    setPhase('preparing');
    try {
      const text = buildAnnouncement(await refresh());
      if (run === speakRun.current) await say(text, run);
    } finally {
      if (run === speakRun.current) setPhase('idle');
    }
  }

  /** "Tolly!" → a quick hello, then the listener waits for a command. */
  async function greet() {
    if (phase !== 'idle') await stopNow();
    const run = ++speakRun.current;
    tap();
    try {
      await say(HELLO, run);
    } finally {
      if (run === speakRun.current) setPhase('idle');
    }
  }

  const onSpeakButton = () => void (phase !== 'idle' ? stopNow() : speakBalances());

  async function toggleHandsFree() {
    const on = hands.state === 'sleeping' || hands.state === 'awake';
    if (on) hands.disable();
    else {
      void prewarm(HELLO); // so "Tolly!" gets an instant hello
      await hands.enable();
    }
    await setHandsFreeOn(!on);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const [done, creds, et] = await Promise.all([isSetupDone(), getAutosweepCreds(), getEasytripAccount()]);
      if (!alive) return;
      if (!done && !creds && !et) {
        router.replace('/setup'); // first run: friendly setup instead of an empty screen
        return;
      }
      setReadings(await cachedReadings()); // paint saved balances instantly…
      if (!alive) return;
      // Phones remember hands-free; browsers need a tap each visit before they may play audio.
      if (Platform.OS !== 'web' && (await isHandsFreeOn())) void hands.enable();
      if (params.speak === '1' && !autoSpoke.current) {
        autoSpoke.current = true; // "Hear my balances" from the end of setup
        await speakBalances();
      } else {
        await refresh(); // …then fetch live in the background
      }
    })();
    const tick = setInterval(() => setNow(nowMs()), 30_000);
    const off = onVoiceStatus(setVoice);
    return () => {
      alive = false;
      clearInterval(tick);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  function openDrawer(t: Tab) {
    setTab(t);
    setDrawer(true);
  }

  function onSaved() {
    setConfetti((c) => c + 1);
    success();
    void refresh();
  }

  const autosweep = readings.find((r) => r.label === 'Autosweep');
  const easytrip = readings.find((r) => r.label === 'Easytrip');
  const low = readings.filter((r) => r.amount !== null && r.amount < LOW_BALANCE);
  const total = readings.reduce((s, r) => s + (r.amount ?? 0), 0);
  const updatedLabel = updating ? 'Updating…' : updatedAt ? `Updated ${ago(now - updatedAt) ?? 'just now'}` : 'Tap to update';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello} accessibilityRole="header">
              {low.length ? 'Heads up! ⚠️' : 'Hi there! 👋'}
            </Text>
            <Text style={styles.sub}>
              {low.length
                ? `${low.map((r) => r.label).join(' & ')} ${low.length === 1 ? 'is' : 'are'} running low`
                : readings.length
                  ? `₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in your toll wallet`
                  : 'Add your RFID to get started'}
            </Text>
          </View>
          <ChunkyButton tone="white" size="sm" icon="settings-sharp" accessibilityLabel="Settings" onPress={() => openDrawer('autosweep')} style={{ width: 52 }} />
        </View>

        <View style={styles.tiles}>
          <BalanceTile label="Autosweep" reading={autosweep} now={now} index={0} onPress={() => openDrawer('autosweep')} />
          <BalanceTile label="Easytrip" reading={easytrip} now={now} index={1} onPress={() => openDrawer('easytrip')} />
        </View>

        <PressableScale onPress={() => void refresh()} style={styles.updated} accessibilityLabel={`${updatedLabel}. Refresh`}>
          <Ionicons name={updating ? 'sync' : 'refresh'} size={16} color={colors.tintText} />
          <Text style={styles.updatedText}>{updatedLabel}</Text>
        </PressableScale>
      </View>

      <VoiceStage
        phase={phase}
        transcript={transcript}
        voice={voice}
        mood={low.length ? 'worried' : 'happy'}
        listen={hands.state}
        onSpeak={onSpeakButton}
        onToggleListen={() => void toggleHandsFree()}
      />

      <Sheet open={drawer} onClose={() => setDrawer(false)}>
        <SettingsDrawer tab={tab} onTab={setTab} onSaved={onSaved} onClose={() => setDrawer(false)} />
      </Sheet>

      <Confetti shot={confetti} originY="40%" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: 16, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hello: { fontFamily: fonts.black, fontSize: 30, color: colors.text, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.bold, fontSize: 16, color: colors.muted, marginTop: 2 },
  tiles: { flexDirection: 'row', gap: 12 },
  updated: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.tint,
  },
  updatedText: { fontFamily: fonts.xbold, fontSize: 13, color: colors.tintText },
});
