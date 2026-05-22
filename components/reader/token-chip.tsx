import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { ReaderToken } from '@/features/reader/tokenize';

type TokenChipProps = {
  isSelected: boolean;
  onPress: () => void;
  token: ReaderToken;
};

export function TokenChip({ isSelected, onPress, token }: TokenChipProps) {
  const borderColor = useThemeColor({}, 'icon');
  const textColor = useThemeColor({}, 'text');
  const selectedBackgroundColor = useThemeColor(
    { light: '#11181C', dark: '#F3EFE2' },
    'text'
  );
  const selectedTextColor = useThemeColor(
    { light: '#F9F2DF', dark: '#11181C' },
    'background'
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.tokenChip,
        {
          borderColor,
        },
        isSelected && {
          backgroundColor: selectedBackgroundColor,
          borderColor: selectedBackgroundColor,
        },
      ]}>
      <ThemedText
        style={[
          styles.tokenValue,
          {
            color: isSelected ? selectedTextColor : textColor,
          },
        ]}>
        {token.value}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tokenChip: {
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tokenValue: {
    fontSize: 15,
    lineHeight: 18,
  },
});
