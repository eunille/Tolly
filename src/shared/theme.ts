import { Easing } from 'react-native-reanimated';

// Playful Catalyx palette: bright faces with a darker "lip" underneath for the chunky 3D look.
// Text colours on each face are checked for WCAG AA at the sizes used.
export const colors = {
  bg: '#FFFFFF',
  text: '#25303D',
  muted: '#6B7380', // 4.8:1 on white
  border: '#E5E8EE',
  lip: '#D3D8E0', // card/button bottom edge

  red: '#FF5045',
  redLip: '#D23A30',
  blue: '#1596F0',
  blueLip: '#0C72BA',
  blueDeep: '#0F6BC4', // voice stage
  blueDeepLip: '#0A4F93',
  yellow: '#F7C934',
  yellowLip: '#D4A514',
  ink: '#25303D', // dark text on yellow/white

  tint: '#E8F4FE',
  tintText: '#0C66AE',
  soft: '#F4F6F9', // input fill
} as const;

export const fonts = {
  semi: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  xbold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const radius = { card: 24, control: 16, pill: 999, stage: 36 } as const;

export const ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1), // entering, press
  inOut: Easing.bezier(0.77, 0, 0.175, 1), // on-screen movement
  drawer: Easing.bezier(0.32, 0.72, 0, 1), // iOS-like sheet
};

/** Springy release for chunky buttons: a little bounce, settles fast. */
export const bounce = { damping: 12, stiffness: 420, mass: 0.6 } as const;
