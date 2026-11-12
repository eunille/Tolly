import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { VoiceStatus } from '@/features/voice/speak';
import { Tolly, type Mood } from '@/features/voice/Tolly';
import type { ListenState } from '@/features/voice/useHandsFree';
import { VoiceWave } from '@/features/voice/VoiceWave';
import { colors, fonts, radius } from '@/shared/theme';
import { ChunkyButton } from '@/shared/ui/ChunkyButton';
import { PressableScale } from '@/shared/ui/PressableScale';

export type Phase = 'idle' | 'preparing' | 'speaking';

// ponytail: karaoke advances at a fixed ~3 words/s (Phonon's measured pace: 11 words in 3.7 s).
// Switch to real word timings (expo-speech onBoundary / Phonon chunk times) if it drifts noticeably.
const WORD_MS = 330;

const LISTEN_CHIP: Record<ListenState, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  off: { icon: 'mic-off', label: 'Hands-free off' },
  sleeping: { icon: 'mic', label: 'Say “Tolly”' },
  awake: { icon: 'mic', label: 'Listening…' },
  denied: { icon: 'mic-off', label: 'Mic blocked' },
  unsupported: { icon: 'mic-off', label: 'No voice input here' },
};

/**
 * Karaoke subtitles: the whole line is visible from the start (dim), words light up as they're
 * spoken, and the current word sits in a yellow highlight. Remounted per utterance via `key`.
 */
function Karaoke({ text }: { text: string }) {
  const words = text.split(' ');
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => (x >= words.length ? x : x + 1)), WORD_MS);
    return () => clearInterval(id);
  }, [words.length]);
  return (
    <Text style={styles.subtitle} numberOfLines={3} accessibilityLiveRegion="polite" accessibilityLabel={text}>
      {words.map((w, i) => (
        <Text key={i}>
          <Text style={i === n ? styles.wordNow : i < n ? styles.wordSaid : styles.wordNext}>{w}</Text>{' '}
        </Text>
      ))}
    </Text>
  );
}

/** Three dots that breathe while Tolly is getting ready. Static dots with reduced motion. */
function Dots() {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.set(withRepeat(withTiming(1, { duration: 900 }), -1));
  }, [reduce, t]);
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i} t={t} />
      ))}
    </View>
  );
}
function Dot({ i, t }: { i: number; t: ReturnType<typeof useSharedValue<number>> }) {
  const style = useAnimatedStyle(() => {
    const phase = (t.get() + i / 3) % 1;
    return { opacity: 0.35 + 0.65 * Math.sin(phase * Math.PI) };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/** Bottom half of home: the voice is the product, so it gets the stage. */
export function VoiceStage({
  phase,
  transcript,
  voice,
  mood,
  listen,
  onSpeak,
  onToggleListen,
}: {
  phase: Phase;
  transcript: string;
  voice: VoiceStatus;
  mood: Mood;
  listen: ListenState;
  onSpeak: () => void;
  onToggleListen: () => void;
}) {
  const insets = useSafeAreaInsets();
  const busy = phase !== 'idle';
  const awake = listen === 'awake';
  const handsFree = listen === 'sleeping' || awake;
  const chip = LISTEN_CHIP[listen];
  const listening = awake && phase === 'idle';

  const status = phase === 'speaking' ? 'Speaking' : phase === 'preparing' ? 'Thinking' : listening ? 'Listening' : 'Tolly';
  const hint =
    phase === 'preparing'
      ? voice.state === 'loading'
        ? `Warming up my voice… ${Math.round(voice.progress * 100)}%`
        : 'Checking your balances'
      : awake
        ? 'I’m listening! Say “balances” or “stop”.'
        : mood === 'worried'
          ? handsFree
            ? 'Something is running low. Say “Tolly” and I’ll tell you.'
            : 'Something is running low. Tap Speak and I’ll tell you.'
          : handsFree
            ? 'Just say “Tolly” and I’ll wake up.'
            : 'Tap Speak, or turn on hands-free and say “Tolly”.';

  return (
    <View style={[styles.stage, { paddingBottom: insets.bottom + 16 }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.shape, { width: 240, height: 240, borderRadius: 120, right: -90, top: -40 }]} />
        <View style={[styles.shape, { width: 150, height: 150, borderTopRightRadius: 150, left: -40, bottom: 70 }]} />
        <View style={[styles.shape, { width: 16, height: 16, left: 48, top: 64, transform: [{ rotate: '45deg' }] }]} />
      </View>

      <View style={styles.topRow}>
        <PressableScale
          onPress={onToggleListen}
          style={[styles.listenChip, handsFree && styles.listenChipOn, awake && styles.listenChipAwake]}
          accessibilityRole="switch"
          accessibilityState={{ checked: handsFree }}
          accessibilityLabel={`Hands-free listening. ${chip.label}`}
        >
          <Ionicons name={chip.icon} size={15} color={awake ? colors.ink : '#FFFFFF'} />
          <Text style={[styles.listenText, awake && { color: colors.ink }]}>{chip.label}</Text>
        </PressableScale>
      </View>

      <Tolly size={84} talking={phase === 'speaking'} mood={mood} alert={awake} />

      {/* Subtitle card */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={[styles.liveDot, { backgroundColor: phase === 'speaking' ? colors.red : listening ? colors.yellow : 'rgba(255,255,255,0.4)' }]} />
          <Text style={styles.cardLabel}>{status}</Text>
        </View>
        {phase === 'speaking' && transcript ? (
          <Karaoke key={transcript} text={transcript} />
        ) : (
          <View style={styles.hintRow}>
            <Text style={styles.hint} accessibilityLiveRegion="polite">
              {hint}
            </Text>
            {phase === 'preparing' && <Dots />}
          </View>
        )}
      </View>

      {/* White wave = Tolly talking. Yellow wave = Tolly listening. */}
      <VoiceWave
        active={phase === 'speaking' || listening}
        color={listening ? colors.yellow : '#FFFFFF'}
        accent={listening ? '#FFFFFF' : colors.yellow}
        height={64}
      />

      <ChunkyButton
        size="lg"
        tone={busy ? 'red' : 'yellow'}
        icon={busy ? 'stop' : 'volume-high'}
        label={busy ? 'Stop' : 'Speak'}
        accessibilityLabel={busy ? 'Stop speaking' : 'Speak my balances'}
        onPress={onSpeak}
        style={{ alignSelf: 'stretch', marginTop: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    marginTop: 16,
    backgroundColor: colors.blueDeep,
    borderTopLeftRadius: radius.stage,
    borderTopRightRadius: radius.stage,
    paddingHorizontal: 18,
    paddingTop: 14,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  shape: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.06)' },
  topRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'flex-start', height: 34, marginBottom: -34, zIndex: 1 },
  listenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  listenChipOn: { backgroundColor: 'rgba(255,255,255,0.24)' },
  listenChipAwake: { backgroundColor: colors.yellow },
  listenText: { fontFamily: fonts.xbold, fontSize: 13, color: '#FFFFFF' },

  card: {
    alignSelf: 'stretch',
    flex: 1,
    minHeight: 92,
    borderRadius: 22,
    padding: 14,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  cardLabel: { fontFamily: fonts.black, fontSize: 11, letterSpacing: 1.2, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' },
  subtitle: { fontFamily: fonts.xbold, fontSize: 20, lineHeight: 30, color: '#FFFFFF' },
  wordSaid: { color: '#FFFFFF' },
  wordNext: { color: 'rgba(255,255,255,0.38)' },
  wordNow: { color: colors.ink, backgroundColor: colors.yellow, borderRadius: 6 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  hint: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: 'rgba(255,255,255,0.9)', flexShrink: 1 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
});
