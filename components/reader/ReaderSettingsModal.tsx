import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { readerScreenStyles as styles } from "@/components/reader/reader-screen-styles";
import { SettingsStepper } from "@/components/reader/SettingsStepper";
import { ThemedText } from "@/components/themed-text";

type ReaderSettingsModalProps = {
  visible: boolean;
  overlayColor: string;
  panelColor: string;
  panelBorder: string;
  dockShadow: string;
  textColor: string;
  chromeText: string;
  accentSoft: string;
  fontFamily: "serif" | "rounded" | "sans";
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  horizontalInset: number;
  verticalInset: number;
  onClose: () => void;
  onChangeFontFamily: (fontFamily: "serif" | "rounded" | "sans") => void;
  onChangeFontSize: (fontSize: number) => void;
  onChangeLineHeight: (lineHeight: number) => void;
  onChangeParagraphGap: (paragraphGap: number) => void;
  onChangeHorizontalInset: (horizontalInset: number) => void;
  onChangeVerticalInset: (verticalInset: number) => void;
};

export function ReaderSettingsModal({
  visible,
  overlayColor,
  panelColor,
  panelBorder,
  dockShadow,
  textColor,
  chromeText,
  accentSoft,
  fontFamily,
  fontSize,
  lineHeight,
  paragraphGap,
  horizontalInset,
  verticalInset,
  onClose,
  onChangeFontFamily,
  onChangeFontSize,
  onChangeLineHeight,
  onChangeParagraphGap,
  onChangeHorizontalInset,
  onChangeVerticalInset,
}: ReaderSettingsModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.settingsModalRoot}>
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: overlayColor }]}
          onPress={onClose}
        />
        <View
          style={[
            styles.settingsSheet,
            {
              backgroundColor: panelColor,
              borderColor: panelBorder,
              boxShadow: `0px 18px 34px ${dockShadow}`,
            },
          ]}
        >
          <View style={styles.settingsSheetHeader}>
            <View style={styles.heroCopy}>
              <ThemedText style={[styles.chapterEyebrow, { color: chromeText }]}>
                Reader
              </ThemedText>
              <ThemedText style={[styles.settingsSheetTitle, { color: textColor }]}>
                Reading Layout
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.focusReturnButton, { borderColor: panelBorder }]}
            >
              <Text style={[styles.sheetActionText, { color: textColor }]}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.settingsPanel}>
            <View style={styles.settingsRow}>
              <ThemedText style={[styles.settingsLabel, { color: chromeText }]}>
                Font
              </ThemedText>
              <View style={styles.choiceRow}>
                {(
                  [
                    ["serif", "Serif"],
                    ["rounded", "Rounded"],
                    ["sans", "Sans"],
                  ] as const
                ).map(([nextFontFamily, label]) => (
                  <Pressable
                    key={nextFontFamily}
                    onPress={() => onChangeFontFamily(nextFontFamily)}
                    style={[
                      styles.choiceChip,
                      {
                        borderColor: panelBorder,
                        backgroundColor:
                          fontFamily === nextFontFamily ? accentSoft : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.choiceChipText, { color: textColor }]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <SettingsStepper
              label="Size"
              value={fontSize}
              decrementLabel="A-"
              incrementLabel="A+"
              onDecrement={() => onChangeFontSize(fontSize - 2)}
              onIncrement={() => onChangeFontSize(fontSize + 2)}
              borderColor={panelBorder}
              textColor={textColor}
              chromeText={chromeText}
            />

            <SettingsStepper
              label="Leading"
              value={lineHeight}
              onDecrement={() => onChangeLineHeight(lineHeight - 2)}
              onIncrement={() => onChangeLineHeight(lineHeight + 2)}
              borderColor={panelBorder}
              textColor={textColor}
              chromeText={chromeText}
            />

            <SettingsStepper
              label="Paragraph Gap"
              value={paragraphGap}
              onDecrement={() => onChangeParagraphGap(paragraphGap - 2)}
              onIncrement={() => onChangeParagraphGap(paragraphGap + 2)}
              borderColor={panelBorder}
              textColor={textColor}
              chromeText={chromeText}
            />

            <SettingsStepper
              label="Horizontal Inset"
              value={horizontalInset}
              decrementLabel="-"
              incrementLabel="+"
              onDecrement={() => onChangeHorizontalInset(horizontalInset - 4)}
              onIncrement={() => onChangeHorizontalInset(horizontalInset + 4)}
              borderColor={panelBorder}
              textColor={textColor}
              chromeText={chromeText}
            />

            <SettingsStepper
              label="Viewport Inset"
              value={verticalInset}
              decrementLabel="-"
              incrementLabel="+"
              onDecrement={() => onChangeVerticalInset(verticalInset - 4)}
              onIncrement={() => onChangeVerticalInset(verticalInset + 4)}
              borderColor={panelBorder}
              textColor={textColor}
              chromeText={chromeText}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
