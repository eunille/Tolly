import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { colors } from '@/shared/theme';

export type Mood = 'happy' | 'worried';

const sine = Easing.inOut(Easing.sin);
const VISOR = '#0E1F38';
const GLOW = '#7FD4FF'; // eyes + mouth light
const MOUTH_BARS = [0.55, 0.9, 1, 0.8, 0.5]; // resting shape of the light-bar mouth
const MOUTH_MS = [150, 110, 130, 95, 140]; // uneven speeds = speech-like flicker

function MouthBar({ i, talking, reduce, color }: { i: number; talking: boolean; reduce: boolean; color: string }) {
  const h = useSharedValue(MOUTH_BARS[i] * 0.35);
  useEffect(() => {
    cancelAnimation(h);
    h.set(
      talking && !reduce
        ? withRepeat(withSequence(withTiming(MOUTH_BARS[i], { duration: MOUTH_MS[i] }), withTiming(0.2, { duration: MOUTH_MS[i] })), -1)
        : withTiming(talking ? MOUTH_BARS[i] * 0.7 : MOUTH_BARS[i] * 0.35, { duration: 150 }),
    );
  }, [talking, reduce, i, h]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: h.get() }] }));
  return <Animated.View style={[styles.mouthBar, { backgroundColor: color, shadowColor: color }, style]} />;
}

function Eye({ side, blink, color, worried }: { side: 'l' | 'r'; blink: SharedValue<number>; color: string; worried: boolean }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.get() }] }));
  return (
    <View style={[styles.eyeSlot, side === 'l' ? { left: 17 } : { right: 17 }]}>
      <Animated.View style={[styles.eye, { backgroundColor: color, shadowColor: color }, style]} />
      {worried && (
        // A slanted visor-coloured lid over the inner top corner reads as a worried brow.
        <View style={[styles.lid, side === 'l' ? { left: -4, transform: [{ rotate: '-24deg' }] } : { right: -4, transform: [{ rotate: '24deg' }] }]} />
      )}
    </View>
  );
}

/**
 * Tolly: the app's own AI-bot mascot. A floating white head with a dark glass visor, glowing pill eyes,
 * a light-bar mouth that becomes a tiny equaliser while it talks, and an RFID-diamond antenna that
 * glows yellow while it listens. Drawn at 96 pt wide and scaled, so every size keeps its proportions.
 */
export function Tolly({
  size = 96,
  talking = false,
  mood = 'happy',
  alert = false,
}: {
  size?: number;
  talking?: boolean;
  mood?: Mood;
  alert?: boolean; // awake and listening: eyes and antenna turn yellow, antenna glows
}) {
  const reduce = useReducedMotion();
  const hover = useSharedValue(0);
  const blink = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    hover.set(withRepeat(withTiming(1, { duration: talking ? 700 : 1800, easing: sine }), -1, true));
    blink.set(withRepeat(withSequence(withDelay(2800, withTiming(0.12, { duration: 70 })), withTiming(1, { duration: 100 })), -1));
    return () => {
      cancelAnimation(hover);
      cancelAnimation(blink);
    };
  }, [reduce, talking, hover, blink]);

  useEffect(() => {
    cancelAnimation(glow);
    glow.set(
      alert
        ? reduce
          ? withTiming(0.6, { duration: 150 })
          : withRepeat(withTiming(1, { duration: 650, easing: sine }), -1, true)
        : withTiming(0, { duration: 150 }),
    );
  }, [alert, reduce, glow]);

  const k = size / 96;
  const botStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -hover.get() * 6 }] }));
  // The shadow stays on the "floor" and shrinks as Tolly floats up.
  const shadowStyle = useAnimatedStyle(() => ({ opacity: 0.28 - hover.get() * 0.1, transform: [{ scaleX: 1 - hover.get() * 0.18 }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: glow.get() * 0.75, transform: [{ scale: 1 + glow.get() * 0.8 }] }));

  const light = alert ? colors.yellow : GLOW;
  const worried = mood === 'worried' && !talking && !alert;

  return (
    <View style={{ width: size, height: 124 * k }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.canvas, { transform: [{ scale: k }] }]}>
        <Animated.View style={[styles.floorShadow, shadowStyle]} />
        <Animated.View style={[StyleSheet.absoluteFill, botStyle]}>
          {/* antenna: stick + RFID diamond tag, glowing while listening */}
          <Animated.View style={[styles.halo, haloStyle]} />
          <View style={styles.stick} />
          <View style={[styles.tag, alert && { backgroundColor: colors.yellow, borderColor: colors.yellowLip }]} />

          {/* ear pods */}
          <View style={[styles.ear, { left: -6 }]} />
          <View style={[styles.ear, { right: -6 }]} />

          {/* head on its lip */}
          <View style={[styles.head, styles.headLip]} />
          <View style={styles.head}>
            <View style={styles.visor}>
              <View style={styles.shine} />
              <Eye side="l" blink={blink} color={light} worried={worried} />
              <Eye side="r" blink={blink} color={light} worried={worried} />
              <View style={styles.mouth}>
                {MOUTH_BARS.map((_, i) => (
                  <MouthBar key={i} i={i} talking={talking} reduce={reduce} color={light} />
                ))}
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'absolute', left: 0, top: 0, width: 96, height: 124, transformOrigin: 'top left' },
  floorShadow: {
    position: 'absolute',
    left: 22,
    top: 112,
    width: 52,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#04122A',
  },
  halo: { position: 'absolute', left: 36, top: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.yellow },
  stick: { position: 'absolute', left: 46.5, top: 12, width: 3, height: 12, borderRadius: 2, backgroundColor: '#C9D2DE' },
  tag: {
    position: 'absolute',
    left: 41,
    top: 2,
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#C9D2DE',
    transform: [{ rotate: '45deg' }],
  },
  ear: { position: 'absolute', top: 50, width: 14, height: 30, borderRadius: 7, backgroundColor: colors.red },
  head: { position: 'absolute', left: 0, top: 24, width: 96, height: 80, borderRadius: 32, backgroundColor: '#FFFFFF' },
  headLip: { top: 29, backgroundColor: '#C9D2DE' },
  visor: {
    position: 'absolute',
    left: 10,
    top: 12,
    width: 76,
    height: 50,
    borderRadius: 20,
    backgroundColor: VISOR,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    left: 8,
    top: 4,
    width: 34,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ rotate: '-8deg' }],
  },
  eyeSlot: { position: 'absolute', top: 11, width: 12, height: 20 },
  eye: {
    width: 12,
    height: 20,
    borderRadius: 6,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  lid: { position: 'absolute', top: -7, width: 20, height: 10, backgroundColor: VISOR },
  mouth: { position: 'absolute', left: 26, right: 26, bottom: 7, height: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  mouthBar: {
    width: 3,
    height: 10,
    borderRadius: 2,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
