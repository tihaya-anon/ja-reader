import { Modal, Pressable, ScrollView, View } from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

import { DictionaryHtmlContent } from "@/components/reader/DictionaryHtmlContent";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { readerScreenStyles as styles } from "@/components/reader/reader-screen-styles";
import type { ReaderNote } from "@/features/reader/reader-annotations-context";
import type { ReaderSelection } from "@/features/reader/reader-screen-types";
import { buildTokenMeta } from "@/features/reader/reader-screen-utils";
type DictionaryEntry = {
  key: string;
  reading?: string;
  definition: string;
};

type ReaderLookupModalProps = {
  visible: boolean;
  selection: ReaderSelection | null;
  dictionaryEntries: DictionaryEntry[];
  selectionNote: ReaderNote | null;
  overlayColor: string;
  panelBorder: string;
  modalCardColor: string;
  modalTextColor: string;
  chromeText: string;
  rubyBookColor: string;
  rubyDictionaryColor: string;
  modalAnimatedStyle: any;
  dragHandleAnimatedStyle: any;
  resizeHandleAnimatedStyle: any;
  dragGesture: any;
  resizeGesture: any;
  onClose: () => void;
  onOpenNoteComposer: () => void;
  onOpenNoteEditor: (noteId: string) => void;
};

export function ReaderLookupModal({
  visible,
  selection,
  dictionaryEntries,
  selectionNote,
  overlayColor,
  panelBorder,
  modalCardColor,
  modalTextColor,
  chromeText,
  rubyBookColor,
  rubyDictionaryColor,
  modalAnimatedStyle,
  dragHandleAnimatedStyle,
  resizeHandleAnimatedStyle,
  dragGesture,
  resizeGesture,
  onClose,
  onOpenNoteComposer,
  onOpenNoteEditor,
}: ReaderLookupModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <View pointerEvents="box-none" style={styles.modalRoot}>
          <Pressable
            style={[styles.modalBackdrop, { backgroundColor: overlayColor }]}
            onPress={onClose}
          />
          <Animated.View
            style={[
              styles.lookupModal,
              modalAnimatedStyle,
              {
                backgroundColor: modalCardColor,
                borderColor: panelBorder,
              },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: panelBorder }]}>
              <View style={styles.modalHeaderCopy}>
                <ThemedText style={[styles.modalTitle, { color: modalTextColor }]}>
                  {selection?.type === "token" ? selection.token.surface : "Sentence"}
                </ThemedText>
                <ThemedText style={[styles.modalMeta, { color: chromeText }]}>
                  {selection?.type === "token"
                    ? buildTokenMeta(selection.token)
                    : "Double-tap to select a sentence"}
                </ThemedText>
              </View>
              <View style={styles.modalHeaderActions}>
                <Pressable
                  onPress={onOpenNoteComposer}
                  style={[styles.modalIconButton, { borderColor: panelBorder }]}
                >
                  <IconSymbol
                    name="square.and.pencil"
                    size={18}
                    color={modalTextColor}
                  />
                </Pressable>
                <GestureDetector gesture={dragGesture}>
                  <Animated.View style={[styles.modalHandle, dragHandleAnimatedStyle]}>
                    <View
                      style={[styles.modalHandleBar, { backgroundColor: chromeText }]}
                    />
                    <View
                      style={[styles.modalHandleBar, { backgroundColor: chromeText }]}
                    />
                  </Animated.View>
                </GestureDetector>
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {selection?.type === "sentence" ? (
                <ThemedText style={[styles.sentenceText, { color: modalTextColor }]}>
                  {selection.text}
                </ThemedText>
              ) : dictionaryEntries.length > 0 ? (
                <>
                  <View style={styles.rubyLegend}>
                    <LegendItem
                      color={rubyBookColor}
                      label="EPUB ruby"
                      textColor={chromeText}
                    />
                    <LegendItem
                      color={rubyDictionaryColor}
                      label="Dictionary ruby"
                      textColor={chromeText}
                    />
                  </View>
                  {dictionaryEntries.map((entry) => (
                    <View
                      key={`${entry.key}-${entry.definition.slice(0, 40)}`}
                      style={styles.entryBlock}
                    >
                      <ThemedText style={[styles.entryKey, { color: modalTextColor }]}>
                        {entry.key}
                        {entry.reading ? ` · ${entry.reading}` : ""}
                      </ThemedText>
                      <DictionaryHtmlContent
                        html={entry.definition}
                        textColor={modalTextColor}
                        linkColor={rubyDictionaryColor}
                        accentColor={rubyBookColor}
                      />
                    </View>
                  ))}
                </>
              ) : (
                <ThemedText style={[styles.emptyStateText, { color: chromeText }]}>
                  No local dictionary entry for this token yet.
                </ThemedText>
              )}

              {selectionNote ? (
                <View style={styles.notesSection}>
                  <ThemedText style={[styles.notesSectionTitle, { color: modalTextColor }]}>
                    Note
                  </ThemedText>
                  <Pressable
                    onPress={() => onOpenNoteEditor(selectionNote.id)}
                    style={[
                      styles.noteCard,
                      { borderColor: panelBorder, backgroundColor: modalCardColor },
                    ]}
                  >
                    <ThemedText style={[styles.noteTitle, { color: modalTextColor }]}>
                      {selectionNote.title}
                    </ThemedText>
                    <ThemedText style={[styles.noteBody, { color: modalTextColor }]}>
                      {selectionNote.body}
                    </ThemedText>
                    <ThemedText style={[styles.noteMeta, { color: chromeText }]}>
                      AI ready · {selectionNote.aiContext.tags.join(" · ")}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>

            <GestureDetector gesture={resizeGesture}>
              <Animated.View style={[styles.resizeHandle, resizeHandleAnimatedStyle]}>
                <View style={[styles.resizeGrip, { borderColor: chromeText }]} />
                <View
                  style={[styles.resizeGripSecondary, { borderColor: chromeText }]}
                />
              </Animated.View>
            </GestureDetector>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function LegendItem({
  color,
  label,
  textColor,
}: {
  color: string;
  label: string;
  textColor: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText style={[styles.legendText, { color: textColor }]}>
        {label}
      </ThemedText>
    </View>
  );
}
