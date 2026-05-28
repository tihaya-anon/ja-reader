import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { ReaderChapterContent } from "@/components/reader/ReaderChapterContent";
import { ReaderLookupModal } from "@/components/reader/ReaderLookupModal";
import { ReaderNoteComposerModal } from "@/components/reader/ReaderNoteComposerModal";
import { ReaderSettingsModal } from "@/components/reader/ReaderSettingsModal";
import { readerScreenStyles as styles } from "@/components/reader/reader-screen-styles";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";
import { useReaderScreenController } from "@/features/reader/use-reader-screen-controller";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function ReaderScreen() {
  const controller = useReaderScreenController();
  const { readerChrome, readerSettings, readerState } = controller;

  const textColor = useThemeColor(
    { light: "#201A14", dark: "#F6F0E3" },
    "text",
  );
  const pageBackground = useThemeColor(
    { light: "#F4E7CF", dark: "#171A19" },
    "background",
  );
  const panelColor = useThemeColor(
    { light: "#FBF5EA", dark: "#202523" },
    "background",
  );
  const panelBorder = useThemeColor(
    { light: "#D7C3A0", dark: "#3D4641" },
    "icon",
  );
  const chromeText = useThemeColor(
    { light: "#6B5B42", dark: "#B8A98C" },
    "icon",
  );
  const tokenHighlightColor = useThemeColor(
    { light: "#D7B98B", dark: "#5A503F" },
    "background",
  );
  const sentenceHighlightColor = useThemeColor(
    { light: "#EFE2C8", dark: "#2B312A" },
    "background",
  );
  const rubyBookColor = useThemeColor(
    { light: "#9B4D2F", dark: "#E3A66C" },
    "tint",
  );
  const rubyDictionaryColor = useThemeColor(
    { light: "#466C9B", dark: "#7DB2E8" },
    "icon",
  );
  const overlayColor = useThemeColor(
    { light: "rgba(23, 18, 12, 0.18)", dark: "rgba(8, 9, 8, 0.42)" },
    "background",
  );
  const modalCardColor = useThemeColor(
    { light: "#FFF8EC", dark: "#1D211F" },
    "background",
  );
  const modalTextColor = useThemeColor(
    { light: "#32281C", dark: "#F0E7D5" },
    "text",
  );
  const accentSoft = useThemeColor(
    { light: "#E8CFA4", dark: "#4B4232" },
    "background",
  );
  const dockShadow = useThemeColor(
    { light: "rgba(65, 44, 20, 0.16)", dark: "rgba(0, 0, 0, 0.28)" },
    "background",
  );

  const readerFontFamily =
    readerSettings.appearanceSettings.fontFamily === "sans"
      ? Fonts.sans
      : readerSettings.appearanceSettings.fontFamily === "rounded"
        ? Fonts.rounded
        : Fonts.serif;
  const contentHorizontalPadding = 18 + readerSettings.appearanceSettings.horizontalInset;
  const viewportVerticalInset = 24 + readerSettings.appearanceSettings.verticalInset;
  const readingViewportHeight = Math.max(
    controller.viewportHeight - 88 - viewportVerticalInset * 2 - 84,
    240,
  );

  const paragraphRowStyle = useMemo(
    () => ({
      rowGap: Math.max(readerSettings.appearanceSettings.paragraphGap / 2, 10),
    }),
    [readerSettings.appearanceSettings.paragraphGap],
  );
  const baseTextStyle = useMemo(
    () => ({
      fontFamily: readerFontFamily,
      fontSize: readerSettings.appearanceSettings.fontSize,
      lineHeight: readerSettings.appearanceSettings.lineHeight,
    }),
    [
      readerFontFamily,
      readerSettings.appearanceSettings.fontSize,
      readerSettings.appearanceSettings.lineHeight,
    ],
  );
  const rubyTextStyle = useMemo(
    () => ({
      fontSize: Math.max(
        Math.round(readerSettings.appearanceSettings.fontSize * 0.42),
        11,
      ),
      lineHeight: Math.max(
        Math.round(readerSettings.appearanceSettings.fontSize * 0.5),
        13,
      ),
    }),
    [readerSettings.appearanceSettings.fontSize],
  );
  const readingPanelStyle = useMemo(
    () => ({
      gap: readerSettings.appearanceSettings.paragraphGap,
      paddingHorizontal: readerSettings.appearanceSettings.horizontalInset,
    }),
    [
      readerSettings.appearanceSettings.horizontalInset,
      readerSettings.appearanceSettings.paragraphGap,
    ],
  );

  return (
    <ThemedView style={[styles.screen, { backgroundColor: pageBackground }]}>
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: contentHorizontalPadding,
            paddingTop: viewportVerticalInset,
            paddingBottom: viewportVerticalInset,
          },
        ]}
      >
        <ReaderHeader
          chapterIndex={readerState.chapterIndex}
          chapterTitle={readerState.chapter.title}
          bookTitle={readerState.book.title}
          textColor={textColor}
          chromeText={chromeText}
          panelBorder={panelBorder}
          accentSoft={accentSoft}
          isBookmarked={Boolean(controller.currentBookmark)}
          onToggleBookmark={controller.toggleBookmark}
        />

        <ReaderChapterContent
          chapterId={readerState.chapter.id}
          paragraphUnits={controller.paragraphUnits}
          selectedParagraphIndex={readerState.selectedParagraphIndex}
          selection={controller.selection}
          noteAnnotatedRanges={controller.noteAnnotatedRanges}
          readingViewportHeight={readingViewportHeight}
          readingPanelStyle={readingPanelStyle}
          paragraphRowStyle={paragraphRowStyle}
          baseTextStyle={baseTextStyle}
          rubyTextStyle={rubyTextStyle}
          textColor={textColor}
          sentenceHighlightColor={sentenceHighlightColor}
          tokenHighlightColor={tokenHighlightColor}
          rubyBookColor={rubyBookColor}
          rubyDictionaryColor={rubyDictionaryColor}
          onSelectParagraph={readerState.selectParagraph}
          onPressToken={(paragraphIndex, paragraph, token) => {
            const isTokenSelected = isTokenSelectedInParagraph({
              selection: controller.selection,
              token,
              paragraphIndex,
              selectedParagraphIndex: readerState.selectedParagraphIndex,
            });
            const isSentenceSelected = isTokenInsideSentenceSelection({
              selection: controller.selection,
              token,
              paragraphIndex,
              selectedParagraphIndex: readerState.selectedParagraphIndex,
            });

            controller.handleTokenPress(
              paragraphIndex,
              paragraph,
              token,
              isTokenSelected,
              isSentenceSelected,
            );
          }}
        />
      </View>

      <ReaderSettingsModal
        visible={readerChrome.isSettingsVisible}
        overlayColor={overlayColor}
        panelColor={panelColor}
        panelBorder={panelBorder}
        dockShadow={dockShadow}
        textColor={textColor}
        chromeText={chromeText}
        accentSoft={accentSoft}
        fontFamily={readerSettings.appearanceSettings.fontFamily}
        fontSize={readerSettings.appearanceSettings.fontSize}
        lineHeight={readerSettings.appearanceSettings.lineHeight}
        paragraphGap={readerSettings.appearanceSettings.paragraphGap}
        horizontalInset={readerSettings.appearanceSettings.horizontalInset}
        verticalInset={readerSettings.appearanceSettings.verticalInset}
        onClose={() => readerChrome.setIsSettingsVisible(false)}
        onChangeFontFamily={(fontFamily) =>
          readerSettings.setAppearanceSettings({ fontFamily })
        }
        onChangeFontSize={(fontSize) =>
          readerSettings.setAppearanceSettings({ fontSize })
        }
        onChangeLineHeight={(lineHeight) =>
          readerSettings.setAppearanceSettings({ lineHeight })
        }
        onChangeParagraphGap={(paragraphGap) =>
          readerSettings.setAppearanceSettings({ paragraphGap })
        }
        onChangeHorizontalInset={(horizontalInset) =>
          readerSettings.setAppearanceSettings({ horizontalInset })
        }
        onChangeVerticalInset={(verticalInset) =>
          readerSettings.setAppearanceSettings({ verticalInset })
        }
      />

      <ReaderLookupModal
        visible={controller.isLookupVisible}
        selection={controller.selection}
        dictionaryEntries={controller.dictionaryEntries}
        selectionNote={controller.activeSelectionNote}
        overlayColor={overlayColor}
        panelBorder={panelBorder}
        modalCardColor={modalCardColor}
        modalTextColor={modalTextColor}
        chromeText={chromeText}
        rubyBookColor={rubyBookColor}
        rubyDictionaryColor={rubyDictionaryColor}
        modalAnimatedStyle={controller.modalAnimatedStyle}
        dragHandleAnimatedStyle={controller.dragHandleAnimatedStyle}
        resizeHandleAnimatedStyle={controller.resizeHandleAnimatedStyle}
        dragGesture={controller.dragGesture}
        resizeGesture={controller.resizeGesture}
        onClose={controller.closeLookup}
        onOpenNoteComposer={controller.openNoteComposer}
        onOpenNoteEditor={controller.openNoteEditor}
      />

      <ReaderNoteComposerModal
        visible={controller.isNoteComposerVisible}
        overlayColor={overlayColor}
        panelColor={panelColor}
        panelBorder={panelBorder}
        dockShadow={dockShadow}
        textColor={textColor}
        chromeText={chromeText}
        accentSoft={accentSoft}
        modalCardColor={modalCardColor}
        title={controller.editingNoteId ? "Edit Reader Note" : "Linked Reader Note"}
        selectionText={controller.noteSelectionSnapshot?.text ?? ""}
        dictionarySnapshot={controller.noteDictionarySnapshot}
        noteDraft={controller.noteDraft}
        canSave={Boolean(controller.noteSelectionSnapshot && controller.noteDraft.trim())}
        isEditing={Boolean(controller.editingNoteId)}
        onChangeNoteDraft={controller.setNoteDraft}
        onClose={controller.closeNoteComposer}
        onSave={controller.saveNote}
        onDelete={controller.deleteEditingNote}
      />
    </ThemedView>
  );
}

function ReaderHeader({
  chapterIndex,
  chapterTitle,
  bookTitle,
  textColor,
  chromeText,
  panelBorder,
  accentSoft,
  isBookmarked,
  onToggleBookmark,
}: {
  chapterIndex: number;
  chapterTitle: string;
  bookTitle: string;
  textColor: string;
  chromeText: string;
  panelBorder: string;
  accentSoft: string;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  return (
    <View style={styles.headerStrip}>
      <View style={styles.heroCopy}>
        <ThemedText style={[styles.chapterEyebrow, { color: chromeText }]}>
          Chapter {chapterIndex + 1}
        </ThemedText>
        <ThemedText style={[styles.chapterTitle, { color: textColor }]}>
          {chapterTitle}
        </ThemedText>
        <ThemedText style={[styles.bookTitle, { color: chromeText }]}>
          {bookTitle}
        </ThemedText>
      </View>
      <Pressable
        onPress={onToggleBookmark}
        style={[
          styles.headerActionButton,
          {
            borderColor: panelBorder,
            backgroundColor: isBookmarked ? accentSoft : "transparent",
          },
        ]}
      >
        <Text style={[styles.headerActionText, { color: textColor }]}>
          {isBookmarked ? "Bookmarked" : "Bookmark"}
        </Text>
      </Pressable>
    </View>
  );
}

function isTokenSelectedInParagraph({
  selection,
  token,
  paragraphIndex,
  selectedParagraphIndex,
}: {
  selection: ReturnType<typeof useReaderScreenController>["selection"];
  token: Parameters<Parameters<typeof ReaderChapterContent>[0]["onPressToken"]>[2];
  paragraphIndex: number;
  selectedParagraphIndex: number;
}) {
  return (
    paragraphIndex === selectedParagraphIndex &&
    selection?.type === "token" &&
    selection.token.start === token.start &&
    selection.token.end === token.end &&
    selection.token.pos === token.pos &&
    selection.token.surface === token.surface
  );
}

function isTokenInsideSentenceSelection({
  selection,
  token,
  paragraphIndex,
  selectedParagraphIndex,
}: {
  selection: ReturnType<typeof useReaderScreenController>["selection"];
  token: Parameters<Parameters<typeof ReaderChapterContent>[0]["onPressToken"]>[2];
  paragraphIndex: number;
  selectedParagraphIndex: number;
}) {
  return (
    paragraphIndex === selectedParagraphIndex &&
    selection?.type === "sentence" &&
    token.start >= selection.start &&
    token.end <= selection.end
  );
}
