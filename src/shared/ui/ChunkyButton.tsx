import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { tap } from '@/shared/haptics';
import { bounce, colors, fonts, radius } from '@/shared/theme';

const TONES = {
  red: { face: colors.red, lip: colors.redLip, text: '#FFFFFF', border: undefined },
  blue: { face: colors.blue, lip: colors.blueLip, text: '#FFFFFF', border: undefined },
  yellow: { face: colors.yellow, lip: colors.yellowLip, text: colors.ink, border: undefined },
  white: { face: '#FFFFFF', lip: colors.lip, text: colors.tintText, border: colors.border },
} as const;

export type Tone = keyof typeof TONES;
const LIP = 5;

/**
 * The chunky 3D button: a bright face sitting on a darker lip. Pressing pushes the face down
 * onto the lip (fast), releasing springs it back up with a small bounce.
 */
export function ChunkyButton({
  label,
  icon,
  tone = 'blue',
  size = 'md',
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = TONES[disabled ? 'white' : tone];
  const down = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: down.get() * LIP }] }));
  const h = size === 'lg' ? 64 : size === 'sm' ? 44 : 54;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => {
        down.set(withTiming(1, { duration: 70 }));
        tap();
      }}
      onPressOut={() => down.set(withSpring(0, bounce))}
      onPress={onPress}
      style={[{ paddingBottom: LIP }, style, disabled && { opacity: 0.55 }]}
    >
      <View style={[styles.lip, { backgroundColor: t.lip, borderRadius: radius.control }]} />
      <Animated.View
        style={[
          styles.face,
          { backgroundColor: t.face, minHeight: h, borderRadius: radius.control },
          t.border && { borderWidth: 2, borderColor: t.border },
          face,
        ]}
      >
        {icon && <Ionicons name={icon} size={size === 'lg' ? 26 : 20} color={t.text} />}
        {label && (
          <Text style={[styles.label, { color: t.text, fontSize: size === 'lg' ? 20 : size === 'sm' ? 15 : 17 }]}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lip: { position: 'absolute', left: 0, right: 0, top: LIP, bottom: 0 },
  face: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  label: { fontFamily: fonts.black, letterSpacing: 0.6, textTransform: 'uppercase' },
});
