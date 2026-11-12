// First-run setup: one friendly question per screen, Tolly asking, confetti at the end.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CarTrigger } from '../../modules/car-trigger';
import { pairCarWithPermissions } from '@/features/car-trigger/pair';
import { Tolly } from '@/features/voice/Tolly';
import { markSetupDone, setAutosweepCreds, setEasytripAccount, setSeenBalance } from '@/lib/storage';
import { isEasytripAccountNumber } from '@/providers/easytrip/fallback';
import { success } from '@/shared/haptics';
import { errorText } from '@/shared/notify';
import { colors, ease, fonts, radius } from '@/shared/theme';
import { ChunkyButton } from '@/shared/ui/ChunkyButton';
import { Confetti } from '@/shared/ui/Confetti';
import { Input } from '@/shared/ui/Input';
import { PressableScale } from '@/shared/ui/PressableScale';

type Step = 'welcome' | 'which' | 'autosweep' | 'easytrip' | 'car' | 'done';
const hasCarStep = Platform.OS !== 'web';

export default function Setup() {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState({ autosweep: false, easytrip: false });
  const [i, setI] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [carPaired, setCarPaired] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [etAccount, setEtAccount] = useState('');
  const [etSeen, setEtSeen] = useState('');

  const steps: Step[] = [
    'welcome',
    'which',
    ...(picked.autosweep ? (['autosweep'] as const) : []),
    ...(picked.easytrip ? (['easytrip'] as const) : []),
    ...(hasCarStep ? (['car'] as const) : []),
    'done',
  ];
  const step = steps[Math.min(i, steps.length - 1)];
  const progress = i / (steps.length - 1);

  function next() {
    setError('');
    if (steps[i + 1] === 'done') {
      setConfetti((c) => c + 1);
      success();
    }
    setI((x) => Math.min(x + 1, steps.length - 1));
  }

  async function attempt(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      next();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish(hear: boolean) {
    await markSetupDone();
    router.replace(hear ? '/?speak=1' : '/');
  }

  const primary: Record<Step, { label: string; onPress: () => void; disabled?: boolean }> = {
    welcome: { label: "Let's go", onPress: next },
    which: { label: 'Continue', onPress: next, disabled: !picked.autosweep && !picked.easytrip },
    autosweep: {
      label: 'Continue',
      onPress: () =>
        void attempt(async () => {
          if (!email.trim() || !password) throw new Error('I need both your email and password.');
          await setAutosweepCreds({ email: email.trim(), password });
        }),
    },
    easytrip: {
      label: 'Continue',
      onPress: () =>
        void attempt(async () => {
          if (!isEasytripAccountNumber(etAccount)) throw new Error('That should be 12 digits.');
          await setEasytripAccount(etAccount);
          if (etSeen.trim()) {
            const amount = Number(etSeen.replace(/[,₱\s]/g, ''));
            if (!Number.isFinite(amount)) throw new Error('Type the balance as a number, like 520.50');
            await setSeenBalance('easytrip', amount);
          }
        }),
    },
    car: CarTrigger
      ? {
          label: carPaired ? 'Continue' : 'Pair my car',
          onPress: carPaired
            ? next
            : () =>
                void attempt(async () => {
                  if (await pairCarWithPermissions()) setCarPaired(true);
                }),
        }
      : { label: 'Show me how', onPress: () => void Linking.openURL('shortcuts://').finally(next) },
    done: { label: 'Hear my balances', onPress: () => void finish(true) },
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => void finish(false)} accessibilityRole="button" accessibilityLabel="Skip setup" hitSlop={12}>
          <Ionicons name="close" size={30} color={colors.muted} />
        </Pressable>
        <ProgressBar value={progress} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <StepIn key={step}>
          {step === 'welcome' && (
            <Hero title="Hi! I'm Tolly 👋" text="I read your toll balances out loud, so the toll gate never surprises you." />
          )}

          {step === 'which' && (
            <>
              <Ask>Which RFID stickers does your car have?</Ask>
              <Choice
                icon="flash"
                title="Autosweep"
                sub="Skyway, SLEX, NAIA Xway, TPLEX, STAR"
                selected={picked.autosweep}
                onPress={() => setPicked((p) => ({ ...p, autosweep: !p.autosweep }))}
              />
              <Choice
                icon="receipt"
                title="Easytrip"
                sub="NLEX, SCTEX, CAVITEX, CALAX"
                selected={picked.easytrip}
                onPress={() => setPicked((p) => ({ ...p, easytrip: !p.easytrip }))}
              />
              <Text style={styles.tip}>Pick both if you have both.</Text>
            </>
          )}

          {step === 'autosweep' && (
            <>
              <Ask>What&apos;s your Autosweep customer-portal login?</Ask>
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
              <Text style={styles.tip}>🔒 Stays encrypted on this phone. It only ever goes to Autosweep.</Text>
            </>
          )}

          {step === 'easytrip' && (
            <>
              <Ask>What&apos;s your 12-digit Easytrip account number?</Ask>
              <Input label="Account number" value={etAccount} onChangeText={setEtAccount} keyboardType="number-pad" maxLength={12} />
              <Input label="Balance you last saw (optional)" value={etSeen} onChangeText={setEtSeen} keyboardType="decimal-pad" placeholder="₱ 0.00" />
              <Text style={styles.tip}>Easytrip&apos;s site has a CAPTCHA, so you&apos;ll check it there and tell me. I&apos;ll remember how old it is.</Text>
            </>
          )}

          {step === 'car' && (
            <>
              <Ask>
                {CarTrigger
                  ? 'Want me to talk as soon as your car’s Bluetooth connects?'
                  : 'iPhone tip: a Shortcuts automation lets me talk when your car connects.'}
              </Ask>
              {carPaired ? (
                <View style={styles.paired}>
                  <Ionicons name="checkmark-circle" size={28} color={colors.blue} />
                  <Text style={styles.pairedText}>Car paired! I&apos;ll say hi on your next drive.</Text>
                </View>
              ) : (
                <Text style={styles.tip}>
                  {CarTrigger
                    ? 'Pick your car from the list Android shows. No car nearby? You can do this later in Settings.'
                    : 'Automation → Bluetooth → your car → Run Immediately → “Get Toll Balances” → “Speak Text”.'}
                </Text>
              )}
            </>
          )}

          {step === 'done' && <Hero title="You're all set! 🎉" text="Tap Speak any time and I'll read your balances." />}
        </StepIn>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {!!error && (
          <View style={styles.error} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={20} color={colors.redLip} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <ChunkyButton
          size="lg"
          tone={step === 'done' ? 'yellow' : 'blue'}
          label={busy ? 'One sec…' : primary[step].label}
          disabled={busy || primary[step].disabled}
          onPress={primary[step].onPress}
        />
        {(step === 'autosweep' || step === 'easytrip' || step === 'car') && !carPaired && (
          <Pressable onPress={next} accessibilityRole="button" style={styles.skip}>
            <Text style={styles.skipText}>{step === 'car' ? 'Maybe later' : 'Skip for now'}</Text>
          </Pressable>
        )}
      </View>

      <Confetti shot={confetti} originY="35%" />
    </KeyboardAvoidingView>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withSpring(value, { damping: 16, stiffness: 140 }));
  }, [value, v]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.03, v.get()) }] }));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View style={[styles.fill, fill]}>
        <View style={styles.shine} />
      </Animated.View>
    </View>
  );
}

/** Each step slides in from the right: you're moving forward. */
function StepIn({ children }: { children: React.ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withTiming(1, { duration: 260, easing: ease.out }));
  }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: v.get(), transform: [{ translateX: (1 - v.get()) * 28 }] }));
  return <Animated.View style={[{ gap: 18 }, style]}>{children}</Animated.View>;
}

function Hero({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.hero}>
      <Tolly size={150} />
      <Text style={styles.heroTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.heroText}>{text}</Text>
    </View>
  );
}

/** Tolly asking the question in a speech bubble. */
function Ask({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.ask}>
      <Tolly size={76} />
      <View style={styles.bubble}>
        <View style={styles.tail} />
        <Text style={styles.bubbleText} accessibilityRole="header">
          {children}
        </Text>
      </View>
    </View>
  );
}

function Choice({
  icon,
  title,
  sub,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${sub}`}
      style={{ paddingBottom: 5 }}
    >
      <View style={[styles.choiceLip, selected && { backgroundColor: colors.blueLip }]} />
      <View style={[styles.choice, selected && { borderColor: colors.blue, backgroundColor: colors.tint }]}>
        <View style={[styles.choiceIcon, selected && { backgroundColor: colors.blue }]}>
          <Ionicons name={icon} size={24} color={selected ? '#FFFFFF' : colors.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.choiceTitle}>{title}</Text>
          <Text style={styles.choiceSub}>{sub}</Text>
        </View>
        <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={selected ? colors.blue : colors.lip} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingBottom: 8 },
  track: { flex: 1, height: 18, borderRadius: 9, backgroundColor: colors.soft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 9, backgroundColor: colors.blue, transformOrigin: 'left' },
  shine: { position: 'absolute', left: 8, right: 8, top: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
  body: { padding: 20, paddingTop: 24, flexGrow: 1 },

  hero: { alignItems: 'center', gap: 14, paddingTop: 30 },
  heroTitle: { fontFamily: fonts.black, fontSize: 30, color: colors.text, textAlign: 'center' },
  heroText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: colors.muted, textAlign: 'center', maxWidth: 320 },

  ask: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  bubble: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  tail: {
    position: 'absolute',
    left: -9,
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.border,
    transform: [{ rotate: '45deg' }],
  },
  bubbleText: { fontFamily: fonts.xbold, fontSize: 19, lineHeight: 26, color: colors.text },
  tip: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.muted },

  choiceLip: { position: 'absolute', left: 0, right: 0, top: 5, bottom: 0, borderRadius: radius.card, backgroundColor: colors.lip },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  choiceIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontFamily: fonts.black, fontSize: 19, color: colors.text },
  choiceSub: { fontFamily: fonts.semi, fontSize: 13, color: colors.muted, marginTop: 2 },

  paired: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: radius.card, backgroundColor: colors.tint },
  pairedText: { flex: 1, fontFamily: fonts.xbold, fontSize: 16, color: colors.tintText },

  bottom: { paddingHorizontal: 20, paddingTop: 12, gap: 10, borderTopWidth: 2, borderTopColor: colors.border },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.control, backgroundColor: '#FFE5E3' },
  errorText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: '#9A231B' },
  skip: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  skipText: { fontFamily: fonts.black, fontSize: 15, color: colors.tintText, letterSpacing: 0.6, textTransform: 'uppercase' },
});
