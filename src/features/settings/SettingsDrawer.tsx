import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CarTrigger, type Car } from '../../../modules/car-trigger';
import { pairCarWithPermissions } from '@/features/car-trigger/pair';
import {
  getAutosweepCreds,
  getEasytripAccount,
  isAutosweepAuthBlocked,
  setAutosweepCreds,
  setEasytripAccount,
  setSeenBalance,
} from '@/lib/storage';
import { isEasytripAccountNumber, openEasytripBalancePage, smsEasytripBalance } from '@/providers/easytrip/fallback';
import { getVoiceChoice, prewarm, setVoiceChoice, speak, stopSpeaking, voiceChoices } from '@/features/voice/speak';
import { errorText, notify } from '@/shared/notify';
import { colors, fonts, radius } from '@/shared/theme';
import { ChunkyButton } from '@/shared/ui/ChunkyButton';
import { Input } from '@/shared/ui/Input';

export type Tab = 'autosweep' | 'easytrip' | 'car' | 'voice';
const hasCarTab = !!CarTrigger || Platform.OS === 'ios';
const hasVoiceTab = voiceChoices.length > 1;
const PREVIEW = 'Autosweep: 340 pesos. Easytrip: 150 pesos, as of 2 hours ago.';

/** Everything that used to be a wall of forms, one tab at a time inside the drawer. */
export function SettingsDrawer({
  tab,
  onTab,
  onSaved,
  onClose,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  onSaved: () => void; // home refreshes + throws confetti
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBlocked, setAuthBlocked] = useState(false);
  const [etAccount, setEtAccount] = useState('');
  const [etSeen, setEtSeen] = useState('');
  const [car, setCar] = useState<Car | null>(null);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const creds = await getAutosweepCreds();
      const blocked = await isAutosweepAuthBlocked();
      const et = await getEasytripAccount();
      const v = await getVoiceChoice();
      if (!alive) return;
      setVoice(v);
      setEmail(creds?.email ?? ''); // never prefill the password
      setAuthBlocked(blocked);
      setEtAccount(et ?? '');
      setCar(CarTrigger?.getCar() ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify('Hmm, that didn’t work', errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const saveAutosweep = () =>
    run(async () => {
      if (!email.trim() || !password) throw new Error('Enter your Autosweep portal email and password.');
      await setAutosweepCreds({ email: email.trim(), password });
      setPassword('');
      setAuthBlocked(false);
      onSaved();
    });

  const saveEasytrip = () =>
    run(async () => {
      if (!isEasytripAccountNumber(etAccount)) throw new Error('The Easytrip account number is 12 digits.');
      await setEasytripAccount(etAccount);
      if (etSeen.trim()) {
        const amount = Number(etSeen.replace(/[,₱\s]/g, ''));
        if (!Number.isFinite(amount)) throw new Error('Type the balance as a number, like 520.50');
        await setSeenBalance('easytrip', amount);
        setEtSeen('');
      }
      onSaved();
    });

  const withAccount = (fn: (n: string) => Promise<unknown>) =>
    run(async () => {
      if (!isEasytripAccountNumber(etAccount)) throw new Error('Add your 12-digit Easytrip account number first.');
      await fn(etAccount);
    });

  const tabs: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'autosweep', label: 'Autosweep', icon: 'flash' },
    { id: 'easytrip', label: 'Easytrip', icon: 'receipt' },
    ...(hasCarTab ? [{ id: 'car' as const, label: 'Car', icon: 'car-sport' as const }] : []),
    ...(hasVoiceTab ? [{ id: 'voice' as const, label: 'Voice', icon: 'mic' as const }] : []),
  ];

  async function pickVoice(id: string) {
    setVoice(id);
    await setVoiceChoice(id);
    void prewarm(PREVIEW); // start downloading the newly picked voice right away
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((t) => (
          <ChunkyButton
            key={t.id}
            size="sm"
            tone={tab === t.id ? 'blue' : 'white'}
            icon={t.icon}
            label={t.label}
            onPress={() => onTab(t.id)}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {tab === 'autosweep' && (
          <>
            {authBlocked && (
              <Note tone="warn" icon="warning">
                Autosweep said no to that login. I&apos;ve paused checks so your account doesn&apos;t get locked. Re-enter your password.
              </Note>
            )}
            {Platform.OS === 'web' && (
              <Note tone="info" icon="information-circle">
                Browser preview: Autosweep blocks browsers from checking, so it shows &quot;No data&quot; here. The phone app works.
              </Note>
            )}
            <Input label="Portal email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Input label="Portal password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
            <Text style={styles.tip}>🔒 Encrypted on this phone. Only ever sent to Autosweep.</Text>
            <ChunkyButton tone="blue" icon="checkmark" label={busy ? 'Saving…' : 'Save login'} disabled={busy} onPress={() => void saveAutosweep()} />
          </>
        )}

        {tab === 'easytrip' && (
          <>
            <Input label="12-digit account number" value={etAccount} onChangeText={setEtAccount} keyboardType="number-pad" maxLength={12} />
            <Text style={styles.section}>Check your balance</Text>
            <View style={styles.row}>
              <ChunkyButton tone="white" size="sm" icon="globe-outline" label="Website" onPress={() => void withAccount(openEasytripBalancePage)} style={{ flex: 1 }} />
              <ChunkyButton tone="white" size="sm" icon="chatbubble-ellipses-outline" label="Text ₱1" onPress={() => void withAccount(smsEasytripBalance)} style={{ flex: 1 }} />
            </View>
            <Input label="Balance you saw (₱)" value={etSeen} onChangeText={setEtSeen} keyboardType="decimal-pad" placeholder="520.50" />
            <ChunkyButton tone="blue" icon="checkmark" label={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={() => void saveEasytrip()} />
          </>
        )}

        {tab === 'car' && CarTrigger && (
          <>
            <Note tone="info" icon="bluetooth">
              {car ? `Paired with ${car.name}. I'll talk when it connects.` : 'Pair your car and I’ll talk the moment its Bluetooth connects.'}
            </Note>
            {car ? (
              <>
                <ChunkyButton
                  tone="yellow"
                  icon="play"
                  label="Test (lock phone)"
                  onPress={() => {
                    CarTrigger?.testAnnounce(15);
                    notify('Lock your phone now', 'I should speak in about 15 seconds, screen off.');
                  }}
                />
                <ChunkyButton tone="white" icon="close" label="Forget car" onPress={() => (CarTrigger?.forgetCar(), setCar(null))} />
              </>
            ) : (
              <ChunkyButton
                tone="blue"
                icon="bluetooth"
                label="Pair my car"
                onPress={() =>
                  void run(async () => {
                    const paired = await pairCarWithPermissions();
                    if (paired) {
                      setCar(paired);
                      onSaved();
                    }
                  })
                }
              />
            )}
          </>
        )}

        {tab === 'car' && !CarTrigger && Platform.OS === 'ios' && (
          <>
            <Note tone="info" icon="car-sport">
              iPhones use a Shortcuts automation: Automation → Bluetooth → your car → Run Immediately → “Get Toll Balances” → “Speak Text”.
            </Note>
            <ChunkyButton tone="blue" icon="open-outline" label="Open Shortcuts" onPress={() => void Linking.openURL('shortcuts://')} />
          </>
        )}

        {tab === 'voice' && (
          <>
            <Text style={styles.tip}>Both voices run on your device. Pick one, then tap Hear it.</Text>
            {voiceChoices.map((v) => {
              const on = voice === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => void pickVoice(v.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${v.label}. ${v.detail}`}
                  style={[styles.voiceCard, on && styles.voiceCardOn]}
                >
                  <View style={[styles.voiceIcon, on && { backgroundColor: colors.blue }]}>
                    <Ionicons name="mic" size={20} color={on ? '#FFFFFF' : colors.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voiceName}>{v.label}</Text>
                    <Text style={styles.tip}>{v.detail}</Text>
                  </View>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? colors.blue : colors.lip} />
                </Pressable>
              );
            })}
            <View style={styles.row}>
              <ChunkyButton tone="yellow" icon="play" label="Hear it" onPress={() => void speak(PREVIEW)} style={{ flex: 1 }} />
              <ChunkyButton tone="white" icon="stop" label="Stop" onPress={() => void stopSpeaking()} style={{ flex: 1 }} />
            </View>
          </>
        )}

        <Pressable
          onPress={() => {
            onClose();
            router.push('/setup');
          }}
          accessibilityRole="button"
          style={styles.redo}
        >
          <Text style={styles.redoText}>Run setup again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Note({ tone, icon, children }: { tone: 'info' | 'warn'; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const warn = tone === 'warn';
  return (
    <View style={[styles.note, { backgroundColor: warn ? colors.yellow : colors.tint }]} accessibilityRole={warn ? 'alert' : undefined}>
      <Ionicons name={icon} size={20} color={warn ? colors.ink : colors.tintText} />
      <Text style={[styles.noteText, { color: warn ? colors.ink : colors.tintText }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontFamily: fonts.black, fontSize: 26, color: colors.text },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  body: { padding: 20, gap: 16 },
  row: { flexDirection: 'row', gap: 10 },
  section: { fontFamily: fonts.xbold, fontSize: 13, color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: -6 },
  tip: { fontFamily: fonts.bold, fontSize: 14, color: colors.muted },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.control, alignItems: 'flex-start' },
  noteText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 21 },
  redo: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  voiceCardOn: { borderColor: colors.blue, backgroundColor: colors.tint },
  voiceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  voiceName: { fontFamily: fonts.black, fontSize: 17, color: colors.text },
  redoText: { fontFamily: fonts.black, fontSize: 14, color: colors.tintText, letterSpacing: 0.6, textTransform: 'uppercase' },});
