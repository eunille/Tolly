import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { ago, LOW_BALANCE, pesos, type Reading } from '@/features/voice/announcement';
import { colors, fonts, radius } from '@/shared/theme';
import { PressableScale } from '@/shared/ui/PressableScale';

// ponytail: fixed "full tank" for the fuel bar; switch to the user's typical weekly toll spend once we keep history.
const FULL_TANK = 1000;

type Status = { icon: keyof typeof Ionicons.glyphMap; label: string; bg: string; fg: string };

// Never colour alone: every status has an icon and a word.
function statusOf(r: Reading): Status {
  if (r.amount === null) return { icon: 'cloud-offline', label: 'No data', bg: colors.soft, fg: colors.muted };
  if (r.amount < LOW_BALANCE) return { icon: 'warning', label: 'Low', bg: colors.yellow, fg: colors.ink };
  if (r.live) return { icon: 'flash', label: 'Live', bg: colors.tint, fg: colors.tintText };
  return { icon: 'time', label: 'Saved', bg: colors.soft, fg: colors.muted };
}

function when(r: Reading, now: number): string {
  if (r.amount === null) return 'Tap to add';
  if (r.live) return 'just now';
  // Compact for the tile ("4m ago"); the voice still says the full words.
  return (ago(now - r.asOf) ?? 'just now').replace(/ minutes?/, 'm').replace(/ hours?/, 'h').replace(/ days?/, 'd');
}

function FuelBar({ fraction, low, delay }: { fraction: number; low: boolean; delay: number }) {
  const reduce = useReducedMotion();
  const fill = useSharedValue(reduce ? fraction : 0);
  useEffect(() => {
    // Fills up with a springy overshoot when the balance changes: a little "glug".
    fill.set(reduce ? fraction : withDelay(delay, withSpring(fraction, { damping: 14, stiffness: 120 })));
  }, [fraction, delay, reduce, fill]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.04, Math.min(1.02, fill.get())) }] }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: low ? colors.red : colors.blue }, style]}>
        <View style={styles.shine} />
      </Animated.View>
    </View>
  );
}

/** One chunky RFID tile. With no reading it becomes an inviting "add" tile. */
export function BalanceTile({
  label,
  reading,
  now,
  index,
  onPress,
}: {
  label: string;
  reading?: Reading;
  now: number;
  index: number;
  onPress: () => void;
}) {
  if (!reading) {
    return (
      <PressableScale onPress={onPress} style={[styles.tile, styles.addTile]} accessibilityLabel={`Add ${label}`}>
        <View style={styles.addCircle}>
          <Ionicons name="add" size={28} color={colors.blue} />
        </View>
        <Text style={styles.addText}>Add {label}</Text>
      </PressableScale>
    );
  }

  const s = statusOf(reading);
  const low = reading.amount !== null && reading.amount < LOW_BALANCE;
  const whole = reading.amount === null ? '—' : Math.trunc(Math.abs(reading.amount)).toLocaleString('en-PH');
  const cents = reading.amount === null ? '' : `.${String(Math.round(Math.abs(reading.amount) * 100) % 100).padStart(2, '0')}`;
  const spoken =
    reading.amount === null
      ? `${label}, no balance yet. Tap to add.`
      : `${label} balance, ${pesos(reading.amount)}, ${s.label}, ${when(reading, now)}`;

  return (
    <PressableScale onPress={onPress} style={styles.tileWrap} accessibilityLabel={spoken}>
      <View style={styles.lip} />
      <View style={[styles.tile, low && { borderColor: colors.red }]}>
        <View style={styles.head}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{label.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {label}
          </Text>
        </View>

        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {reading.amount !== null && reading.amount < 0 ? '−' : ''}
          <Text style={styles.peso}>₱</Text>
          {whole}
          <Text style={styles.cents}>{cents}</Text>
        </Text>

        <FuelBar fraction={reading.amount === null ? 0 : reading.amount / FULL_TANK} low={low} delay={index * 120} />

        <View style={styles.foot}>
          <View style={[styles.chip, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon} size={12} color={s.fg} />
            <Text style={[styles.chipText, { color: s.fg }]}>{s.label}</Text>
          </View>
          <Text style={styles.when} numberOfLines={1}>
            {when(reading, now)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tileWrap: { flex: 1, paddingBottom: 5 },
  lip: { position: 'absolute', left: 0, right: 0, top: 5, bottom: 0, borderRadius: radius.card, backgroundColor: colors.lip },
  tile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.black, fontSize: 11, color: colors.muted },
  name: { flex: 1, fontFamily: fonts.xbold, fontSize: 15, color: colors.text },
  amount: { fontFamily: fonts.black, fontSize: 30, color: colors.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  peso: { fontSize: 20, color: colors.muted },
  cents: { fontSize: 18, color: colors.muted },
  track: { height: 14, borderRadius: 7, backgroundColor: colors.soft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 7, transformOrigin: 'left' },
  shine: { position: 'absolute', left: 6, right: 6, top: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.xbold, fontSize: 12 },
  when: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.muted },

  addTile: {
    flex: 1,
    borderStyle: 'dashed',
    borderColor: '#B9C3D1',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 168,
    gap: 10,
  },
  addCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.xbold, fontSize: 15, color: colors.tintText, textAlign: 'center' },
});
