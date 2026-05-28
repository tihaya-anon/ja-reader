import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { readerScreenStyles as styles } from "@/components/reader/reader-screen-styles";
import { ThemedText } from "@/components/themed-text";

type DictionarySnapshotEntry = {
  key: string;
  reading?: string;
  definition: string;
};

type ReaderNoteComposerModalProps = {
  visible: boolean;
  overlayColor: string;
  panelColor: string;
  panelBorder: string;
  dockShadow: string;
  textColor: string;
  chromeText: string;
  accentSoft: string;
  modalCardColor: string;
  title: string;
  selectionText: string;
  dictionarySnapshot: DictionarySnapshotEntry[];
  noteDraft: string;
  canSave: boolean;
  isEditing: boolean;
  onChangeNoteDraft: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
};

export function ReaderNoteComposerModal({
  visible,
  overlayColor,
  panelColor,
  panelBorder,
  dockShadow,
  textColor,
  chromeText,
  accentSoft,
  modalCardColor,
  title,
  selectionText,
  dictionarySnapshot,
  noteDraft,
  canSave,
  isEditing,
  onChangeNoteDraft,
  onClose,
  onSave,
  onDelete,
}: ReaderNoteComposerModalProps) {
  const dictionaryEntry = dictionarySnapshot[0];
  const dictionaryValue = dictionaryEntry
    ? `${dictionaryEntry.key}${dictionaryEntry.reading ? ` · ${dictionaryEntry.reading}` : ""}\n${dictionaryEntry.definition}`
    : "";

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.settingsModalRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={24}
      >
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
                Note
              </ThemedText>
              <ThemedText style={[styles.settingsSheetTitle, { color: textColor }]}>
                {title}
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.focusReturnButton, { borderColor: panelBorder }]}
            >
              <Text style={[styles.sheetActionText, { color: textColor }]}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.noteComposerBody}>
            <View style={styles.noteContextBlock}>
              <ThemedText style={[styles.settingsLabel, { color: chromeText }]}>
                Selection
              </ThemedText>
              <ThemedText style={[styles.noteSelectionText, { color: textColor }]}>
                {selectionText || "No active selection"}
              </ThemedText>
            </View>

            {dictionaryEntry ? (
              <View style={styles.noteContextBlock}>
                <ThemedText style={[styles.settingsLabel, { color: chromeText }]}>
                  Dictionary Snapshot
                </ThemedText>
                <View
                  style={[
                    styles.noteDictionaryPanel,
                    {
                      borderColor: panelBorder,
                      backgroundColor: accentSoft,
                    },
                  ]}
                >
                  <ScrollView
                    style={styles.noteDictionaryScroll}
                    contentContainerStyle={styles.noteDictionaryScrollContent}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    <TextInput
                      editable={false}
                      multiline
                      contextMenuHidden={false}
                      showSoftInputOnFocus={false}
                      value={dictionaryValue}
                      style={[
                        styles.noteDictionaryText,
                        styles.noteDictionaryReadonlyInput,
                        { color: textColor },
                      ]}
                    />
                  </ScrollView>
                </View>
              </View>
            ) : null}

            <View style={styles.noteContextBlock}>
              <ThemedText style={[styles.settingsLabel, { color: chromeText }]}>
                Note
              </ThemedText>
              <TextInput
                multiline
                placeholder="Write what you want to remember, compare, or ask AI later."
                placeholderTextColor={chromeText}
                value={noteDraft}
                onChangeText={onChangeNoteDraft}
                style={[
                  styles.noteInput,
                  {
                    color: textColor,
                    borderColor: panelBorder,
                    backgroundColor: modalCardColor,
                  },
                ]}
              />
            </View>

            <View style={styles.noteContextBlock}>
              <ThemedText style={[styles.settingsLabel, { color: chromeText }]}>
                AI Hook
              </ThemedText>
              <ThemedText style={[styles.noteAiHint, { color: chromeText }]}>
                Saved notes keep the selected text, dictionary snapshot, and prompt
                seed so later AI explain/quiz/rewrite actions can reuse them.
              </ThemedText>
            </View>
          </View>

          <View style={styles.noteFooterActions}>
            {isEditing ? (
              <Pressable
                onPress={onDelete}
                style={[
                  styles.noteSecondaryButton,
                  { borderColor: panelBorder, backgroundColor: "transparent" },
                ]}
              >
                <Text style={[styles.sheetActionText, { color: textColor }]}>
                  Delete
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onSave}
              disabled={!canSave}
              style={[
                styles.noteSaveButton,
                {
                  borderColor: panelBorder,
                  backgroundColor: canSave ? accentSoft : "transparent",
                  opacity: canSave ? 1 : 0.5,
                },
              ]}
            >
              <Text style={[styles.sheetActionText, { color: textColor }]}>
                Save note
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
