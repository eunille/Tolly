import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ease } from '@/shared/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that dips to 0.97 on press: instant proof the tap registered. Transform only, so it stays on the GPU. */
export function PressableScale({
  style,
  scaleTo = 0.97,
  disabled,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => scale.set(withTiming(scaleTo, { duration: 120, easing: ease.out }))}
      onPressOut={() => scale.set(withTiming(1, { duration: 200, easing: ease.out }))}
      style={[style, animated, disabled && { opacity: 0.45 }]}
      {...props}
    />
  );
}
