import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ease } from '@/shared/theme';

const BARS = 36;
// Taller in the middle; fixed tables (not Math.random) keep renders pure and the shape stable.
const ENVELOPE = Array.from({ length: BARS }, (_, i) => 0.25 + 0.75 * Math.sin((Math.PI * (i + 0.5)) / BARS));
const DURATION = Array.from({ length: BARS }, (_, i) => 220 + ((i * 73) % 9) * 32); // uneven = organic
const REST = 0.07;
const sine = Easing.inOut(Easing.sin);

function Bar({
  i,
  active,
  reduce,
  color,
  breath,
}: {
  i: number;
  active: boolean;
  reduce: boolean;
  color: string;
  breath: SharedValue<number>;
}) {
  const level = useSharedValue(REST);

  useEffect(() => {
    cancelAnimation(level);
    if (active && !reduce) {
      const d = DURATION[i];
      level.set(
        withDelay(
          (i % 12) * 22, // ripple outward instead of pumping in unison
          withRepeat(
            withSequence(
              withTiming(ENVELOPE[i], { duration: d, easing: sine }),
              withTiming(ENVELOPE[i] * 0.22, { duration: d * 1.15, easing: sine }),
            ),
            -1,
          ),
        ),
      );
    } else {
      level.set(withTiming(active ? ENVELOPE[i] * 0.45 : REST, { duration: 200, easing: ease.out }));
    }
  }, [active, reduce, i, level]);

  // Idle "breathing": a slow swell on top of the resting line. scaleY only, so no layout per frame.
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: level.get() + breath.get() * ENVELOPE[i] * 0.1 }],
  }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

/**
 * Full-width voice wave. Dances while the voice speaks, breathes gently while idle.
 * Reduced motion: bars hold a still shape and only the opacity pulses while speaking.
 */
export function VoiceWave({
  active,
  color,
  accent,
  height = 110,
}: {
  active: boolean;
  color: string;
  accent?: string;
  height?: number;
}) {
  const reduce = useReducedMotion();
  const breath = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(breath);
    cancelAnimation(pulse);
    if (reduce) {
      breath.set(0);
      pulse.set(active ? withRepeat(withTiming(0.5, { duration: 800, easing: sine }), -1, true) : withTiming(1));
    } else {
      breath.set(active ? withTiming(0, { duration: 200 }) : withRepeat(withTiming(1, { duration: 1800, easing: sine }), -1, true));
      pulse.set(1);
    }
  }, [active, reduce, breath, pulse]);

  const fade = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <Animated.View
      style={[styles.wave, { height }, fade]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ENVELOPE.map((_, i) => (
        <Bar key={i} i={i} active={active} reduce={reduce} breath={breath} color={accent && i % 6 === 3 ? accent : color} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wave: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  bar: { flex: 1, maxWidth: 7, height: '100%', borderRadius: 4 },
});
