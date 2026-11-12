import { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ease, radius } from '@/shared/theme';

/**
 * Bottom-sheet drawer. Slides up on the iOS sheet curve, drags down to close (a quick flick is
 * enough), and resists being dragged up past the top instead of hitting a hard wall.
 */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(height); // 0 = fully open
  const startY = useSharedValue(0);

  useEffect(() => {
    y.set(withTiming(open ? 0 : height, { duration: open ? 420 : 260, easing: ease.drawer }));
  }, [open, height, y]);

  const pan = usePanGesture({
    onBegin: () => {
      startY.set(y.get());
    },
    onUpdate: (e) => {
      const next = startY.get() + e.translationY;
      y.set(next < 0 ? next * 0.2 : next); // friction above the top
    },
    onDeactivate: (e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        y.set(withTiming(height, { duration: 220, easing: ease.out }));
        scheduleOnRN(onClose);
      } else {
        y.set(withSpring(0, { damping: 18, stiffness: 260 }));
      }
    },
  });

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(-40, y.get()) }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [0, height], [0.45, 0], 'clamp') }));

  return (
    <View
      pointerEvents={open ? 'auto' : 'none'}
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close settings" />
      </Animated.View>
      <Animated.View style={[styles.panel, { paddingBottom: insets.bottom + 16, maxHeight: height - insets.top - 24 }, panel]}>
        <GestureDetector gesture={pan}>
          <View style={styles.grabZone} accessibilityLabel="Drag down to close">
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#0B1A2E' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.stage,
    borderTopRightRadius: radius.stage,
  },
  grabZone: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 44, height: 6, borderRadius: 3, backgroundColor: colors.border },
});
