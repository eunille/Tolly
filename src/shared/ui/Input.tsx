import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '@/shared/theme';

/** Big friendly field: soft fill, thick border that turns blue while you type. */
export function Input({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, focused && styles.focused]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.xbold, fontSize: 13, color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  input: {
    minHeight: 56,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.soft,
    paddingHorizontal: 16,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
  focused: { borderColor: colors.blue, backgroundColor: '#FFFFFF' },
});
