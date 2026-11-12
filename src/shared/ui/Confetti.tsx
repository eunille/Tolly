import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '@/shared/theme';

// Deterministic pieces (no Math.random in render). One shared clock drives all of them.
const PALETTE = [colors.red, colors.blue, colors.yellow, '#7C5CFF', '#2BC48A'];
const PIECES = Array.from({ length: 40 }, (_, i) => {
  const spread = ((i * 37) % 100) / 100; // 0..1, scrambled
  const angle = (-90 + (spread - 0.5) * 150) * (Math.PI / 180);
  return {
    vx: Math.cos(angle) * (260 + ((i * 53) % 7) * 45),
    vy: Math.sin(angle) * (420 + ((i * 29) % 5) * 70),
    spin: (((i * 61) % 9) - 4) * 220,
    color: PALETTE[i % PALETTE.length],
    w: 7 + (i % 3) * 3,
    h: i % 4 === 0 ? 7 + (i % 3) * 3 : 14,
    round: i % 4 === 0,
  };
});
const GRAVITY = 1100;

function Piece({ p, t }: { p: (typeof PIECES)[number]; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const k = t.get();
    return {
      opacity: k >= 1 ? 0 : 1 - k * k * k,
      transform: [
        { translateX: p.vx * k },
        { translateY: p.vy * k + GRAVITY * k * k },
        { rotate: `${p.spin * k}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.piece, { width: p.w, height: p.h, backgroundColor: p.color, borderRadius: p.round ? 99 : 2 }, style]}
    />
  );
}

/** Fires a burst every time `shot` increases. Skipped entirely with reduced motion. */
export function Confetti({ shot, originY = '45%' }: { shot: number; originY?: `${number}%` }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(1);

  useEffect(() => {
    if (!shot || reduce) return;
    t.set(0);
    t.set(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }));
  }, [shot, reduce, t]);

  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.origin, { top: originY }]}>
        {PIECES.map((p, i) => (
          <Piece key={i} p={p} t={t} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', left: '50%' },
  piece: { position: 'absolute' },
});
