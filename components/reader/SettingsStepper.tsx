import { Pressable, Text, View } from "react-native";

import { readerScreenStyles as styles } from "@/components/reader/reader-screen-styles";
import { ThemedText } from "@/components/themed-text";

type SettingsStepperProps = {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  borderColor: string;
  textColor: string;
  chromeText: string;
  decrementLabel?: string;
  incrementLabel?: string;
};

export function SettingsStepper({
  label,
  value,
  onDecrement,
  onIncrement,
  borderColor,
  textColor,
  chromeText,
  decrementLabel = "-",
  incrementLabel = "+",
}: SettingsStepperProps) {
  return (
    <View style={styles.settingsRow}>
      <ThemedText style={[styles.settingsLabel, { color: chromeText }]}>
        {label}
      </ThemedText>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={onDecrement}
          style={[styles.stepperButton, { borderColor }]}
        >
          <Text style={[styles.stepperText, { color: textColor }]}>
            {decrementLabel}
          </Text>
        </Pressable>
        <ThemedText style={[styles.stepperValue, { color: textColor }]}>
          {value}
        </ThemedText>
        <Pressable
          onPress={onIncrement}
          style={[styles.stepperButton, { borderColor }]}
        >
          <Text style={[styles.stepperText, { color: textColor }]}>
            {incrementLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
