import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";
import type { ReaderParagraph } from "@/data/book-data";
import {
  useReaderAnnotations,
  type ReaderSelectionSnapshot,
} from "@/features/reader/reader-annotations-context";
import { ReaderLookupModal } from "@/features/reader/ReaderLookupModal";
import { ReaderNoteComposerModal } from "@/features/reader/ReaderNoteComposerModal";
import { readerScreenStyles as styles } from "@/features/reader/reader-screen-styles";
import type {
  NoteAnnotatedRange,
  ReaderSelection,
} from "@/features/reader/reader-screen-types";
import {
  buildChapterRubyMap,
  buildParagraphUnits,
  buildSentenceSelection,
  clampModalSettings,
  getTokenHighlightState,
  getTokenNoteMarkers,
  isSameTokenSelection,
  isTokenInsideSentenceSelection,
  summarizeExcerpt,
  toSelectionSnapshot,
} from "@/features/reader/reader-screen-utils";
import {
  useReaderChrome,
  useSetReaderChromeNavigation,
} from "@/features/reader/reader-chrome-context";
import { ReaderSettingsModal } from "@/features/reader/ReaderSettingsModal";
import { useReaderState } from "@/features/reader/reader-state-context";
import type { ReaderToken } from "@/features/reader/tokenize";
import { useReaderSettings } from "@/features/reader/use-reader-settings";
import { useThemeColor } from "@/hooks/use-theme-color";
import { getDictionaryEntriesForToken } from "@/features/reader/lookup";

const DOUBLE_TAP_DELAY_MS = 380;

export default function ReaderScreen() {
  const {
    book,
    chapter,
    chapterIndex,
    chapterTokens,
    selectedParagraph,
    selectedParagraphIndex,
    selectedTokens,
    canGoNextChapter,
    canGoPreviousChapter,
    goToNextChapter,
    goToPreviousChapter,
    selectParagraph,
  } = useReaderState();
  const {
    modalSettings,
    appearanceSettings,
    setModalSettings,
    setAppearanceSettings,
  } = useReaderSettings();
  const { isSettingsVisible, setIsSettingsVisible } = useReaderChrome();
  const setChromeNavigation = useSetReaderChromeNavigation();
  const {
    addBookmark,
    addNote,
    getBookmark,
    getNotesForParagraph,
    getNotesForSelection,
    removeNote,
    removeBookmark,
    updateNote,
  } = useReaderAnnotations();
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [isLookupVisible, setIsLookupVisible] = useState(false);
  const [isNoteComposerVisible, setIsNoteComposerVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteSelectionSnapshot, setNoteSelectionSnapshot] =
    useState<ReaderSelectionSnapshot | null>(null);
  const [noteDictionarySnapshot, setNoteDictionarySnapshot] = useState(
    [] as typeof dictionaryEntries,
  );
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{
    paragraphIndex: number;
    tokenStart: number;
    tokenEnd: number;
    time: number;
  } | null>(null);
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const modalX = useSharedValue(modalSettings.x);
  const modalY = useSharedValue(modalSettings.y);
  const modalWidth = useSharedValue(modalSettings.width);
  const modalHeight = useSharedValue(modalSettings.height);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const resizeStartWidth = useSharedValue(0);
  const resizeStartHeight = useSharedValue(0);
  const dragHandleActive = useSharedValue(0);
  const resizeHandleActive = useSharedValue(0);

  const selectedToken = selection?.type === "token" ? selection.token : null;
  const dictionaryEntries = useMemo(
    () => getDictionaryEntriesForToken(selectedToken),
    [selectedToken],
  );
  const selectionSnapshot = useMemo(
    () => (selection ? toSelectionSnapshot(selection) : null),
    [selection],
  );
  const selectionNotes = useMemo(
    () => getNotesForSelection(selectionSnapshot),
    [getNotesForSelection, selectionSnapshot],
  );
  const activeSelectionNote = selectionNotes[0] ?? null;

  const chapterRubyMap = useMemo(
    () => buildChapterRubyMap(chapter.paragraphs),
    [chapter.paragraphs],
  );

  const paragraphUnits = useMemo(
    () =>
      chapter.paragraphs.map((paragraph, paragraphIndex) => ({
        paragraph,
        units: buildParagraphUnits(
          paragraph,
          chapterTokens,
          paragraphIndex,
          chapterRubyMap,
        ),
      })),
    [chapter.paragraphs, chapterRubyMap, chapterTokens],
  );

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
    appearanceSettings.fontFamily === "sans"
      ? Fonts.sans
      : appearanceSettings.fontFamily === "rounded"
        ? Fonts.rounded
        : Fonts.serif;

  const contentHorizontalPadding = 18 + appearanceSettings.horizontalInset;
  const viewportVerticalInset = 24 + appearanceSettings.verticalInset;
  const tabViewportReserve = 88;
  const readingViewportHeight = Math.max(
    viewportHeight - tabViewportReserve - viewportVerticalInset * 2 - 84,
    240,
  );
  const paragraphRowStyle = useMemo(
    () => ({
      rowGap: Math.max(appearanceSettings.paragraphGap / 2, 10),
    }),
    [appearanceSettings.paragraphGap],
  );
  const baseTextStyle = useMemo(
    () => ({
      fontFamily: readerFontFamily,
      fontSize: appearanceSettings.fontSize,
      lineHeight: appearanceSettings.lineHeight,
    }),
    [
      appearanceSettings.fontSize,
      appearanceSettings.lineHeight,
      readerFontFamily,
    ],
  );
  const rubyTextStyle = useMemo(
    () => ({
      fontSize: Math.max(Math.round(appearanceSettings.fontSize * 0.42), 11),
      lineHeight: Math.max(Math.round(appearanceSettings.fontSize * 0.5), 13),
    }),
    [appearanceSettings.fontSize],
  );
  const readingPanelStyle = useMemo(
    () => ({
      gap: appearanceSettings.paragraphGap,
      paddingHorizontal: appearanceSettings.horizontalInset,
    }),
    [appearanceSettings.horizontalInset, appearanceSettings.paragraphGap],
  );
  const currentParagraphText = chapter.paragraphs[selectedParagraphIndex]?.text ?? "";
  const currentBookmark = getBookmark(chapterIndex, selectedParagraphIndex);
  const paragraphNotes = useMemo(
    () => getNotesForParagraph(chapterIndex, selectedParagraphIndex),
    [chapterIndex, getNotesForParagraph, selectedParagraphIndex],
  );
  const noteAnnotatedRanges = useMemo(
    () =>
      paragraphNotes.map((note) => ({
        type: note.selection.type,
        start: note.selection.start,
        end: note.selection.end,
      })) satisfies NoteAnnotatedRange[],
    [paragraphNotes],
  );

  const clampedModalSettings = useMemo(
    () => clampModalSettings(modalSettings, viewportWidth, viewportHeight),
    [modalSettings, viewportHeight, viewportWidth],
  );

  useEffect(() => {
    setChromeNavigation({
      canGoPreviousChapter,
      canGoNextChapter,
      goToPreviousChapter,
      goToNextChapter,
    });
  }, [
    canGoNextChapter,
    canGoPreviousChapter,
    goToNextChapter,
    goToPreviousChapter,
    setChromeNavigation,
  ]);

  useEffect(() => {
    return () => {
      if (pendingTapRef.current) {
        clearTimeout(pendingTapRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedTokens.length === 0) {
      setSelection(null);
      setIsLookupVisible(false);
      return;
    }

    setSelection((currentSelection) => {
      if (!currentSelection) {
        return null;
      }

      if (currentSelection.type === "token") {
        const nextToken = selectedTokens.find(
          (token) =>
            token.start === currentSelection.token.start &&
            token.end === currentSelection.token.end &&
            token.pos === currentSelection.token.pos &&
            token.surface === currentSelection.token.surface,
        );

        return nextToken ? { type: "token", token: nextToken } : null;
      }

      return currentSelection.end <= selectedParagraph.text.length
        ? currentSelection
        : null;
    });
  }, [selectedParagraph, selectedTokens]);

  useEffect(() => {
    if (selection?.type === "token") {
      setIsLookupVisible(true);
    }
  }, [selection]);

  useEffect(() => {
    if (
      clampedModalSettings.x !== modalSettings.x ||
      clampedModalSettings.y !== modalSettings.y ||
      clampedModalSettings.width !== modalSettings.width ||
      clampedModalSettings.height !== modalSettings.height
    ) {
      setModalSettings(clampedModalSettings);
    }
  }, [clampedModalSettings, modalSettings, setModalSettings]);

  useEffect(() => {
    modalX.value = clampedModalSettings.x;
    modalY.value = clampedModalSettings.y;
    modalWidth.value = clampedModalSettings.width;
    modalHeight.value = clampedModalSettings.height;
  }, [
    clampedModalSettings.height,
    clampedModalSettings.width,
    clampedModalSettings.x,
    clampedModalSettings.y,
    modalHeight,
    modalWidth,
    modalX,
    modalY,
  ]);

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    left: modalX.value,
    top: modalY.value,
    width: modalWidth.value,
    height: modalHeight.value,
  }));

  const dragHandleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dragHandleActive.value ? 0.82 : 1, { duration: 120 }),
    transform: [
      {
        scale: withTiming(dragHandleActive.value ? 0.96 : 1, { duration: 120 }),
      },
    ],
  }));

  const resizeHandleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(resizeHandleActive.value ? 0.82 : 1, { duration: 120 }),
    transform: [
      {
        scale: withTiming(resizeHandleActive.value ? 0.94 : 1, {
          duration: 120,
        }),
      },
    ],
  }));

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          dragHandleActive.value = 1;
          dragStartX.value = modalX.value;
          dragStartY.value = modalY.value;
        })
        .onUpdate((event) => {
          const nextSettings = clampModalSettings(
            {
              x: dragStartX.value + event.translationX,
              y: dragStartY.value + event.translationY,
              width: modalWidth.value,
              height: modalHeight.value,
            },
            viewportWidth,
            viewportHeight,
          );

          modalX.value = nextSettings.x;
          modalY.value = nextSettings.y;
        })
        .onFinalize(() => {
          dragHandleActive.value = 0;
          scheduleOnRN(setModalSettings, {
            x: modalX.value,
            y: modalY.value,
          });
        }),
    [
      dragHandleActive,
      dragStartX,
      dragStartY,
      modalHeight,
      modalWidth,
      modalX,
      modalY,
      setModalSettings,
      viewportHeight,
      viewportWidth,
    ],
  );

  const resizeGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          resizeHandleActive.value = 1;
          resizeStartWidth.value = modalWidth.value;
          resizeStartHeight.value = modalHeight.value;
        })
        .onUpdate((event) => {
          const nextSettings = clampModalSettings(
            {
              x: modalX.value,
              y: modalY.value,
              width: resizeStartWidth.value + event.translationX,
              height: resizeStartHeight.value + event.translationY,
            },
            viewportWidth,
            viewportHeight,
          );

          modalX.value = nextSettings.x;
          modalY.value = nextSettings.y;
          modalWidth.value = nextSettings.width;
          modalHeight.value = nextSettings.height;
        })
        .onFinalize(() => {
          resizeHandleActive.value = 0;
          scheduleOnRN(setModalSettings, {
            x: modalX.value,
            y: modalY.value,
            width: modalWidth.value,
            height: modalHeight.value,
          });
        }),
    [
      modalHeight,
      modalWidth,
      modalX,
      modalY,
      resizeHandleActive,
      resizeStartHeight,
      resizeStartWidth,
      setModalSettings,
      viewportHeight,
      viewportWidth,
    ],
  );

  function closeLookup() {
    setSelection(null);
    setIsLookupVisible(false);
  }

  function closeNoteComposer() {
    setIsNoteComposerVisible(false);
    setNoteDraft("");
    setEditingNoteId(null);
    setNoteSelectionSnapshot(null);
    setNoteDictionarySnapshot([]);
  }

  function toggleBookmark() {
    if (currentBookmark) {
      removeBookmark(currentBookmark.id);
      return;
    }

    addBookmark({
      chapterIndex,
      paragraphIndex: selectedParagraphIndex,
      paragraphText: currentParagraphText,
      excerpt: summarizeExcerpt(currentParagraphText),
    });
  }

  function openNoteComposer() {
    if (!selectionSnapshot) {
      return;
    }

    if (activeSelectionNote) {
      openNoteEditor(activeSelectionNote.id);
      return;
    }

    setNoteDraft("");
    setEditingNoteId(null);
    setNoteSelectionSnapshot(selectionSnapshot);
    setNoteDictionarySnapshot(dictionaryEntries);
    setIsLookupVisible(false);
    setIsNoteComposerVisible(true);
  }

  function openNoteEditor(noteId: string) {
    const note = selectionNotes.find((entry) => entry.id === noteId);
    if (!note) {
      return;
    }

    setEditingNoteId(note.id);
    setNoteDraft(note.body);
    setNoteSelectionSnapshot(note.selection);
    setNoteDictionarySnapshot(
      note.dictionarySnapshot.map((entry) => ({
        key: entry.key,
        reading: entry.reading,
        definition: entry.definition,
      })),
    );
    setIsLookupVisible(false);
    setIsNoteComposerVisible(true);
  }

  function saveNote() {
    if (!noteSelectionSnapshot || !noteDraft.trim()) {
      return;
    }

    if (editingNoteId) {
      updateNote(editingNoteId, noteDraft);
      closeNoteComposer();
      return;
    }

    addNote({
      chapterIndex,
      chapterTitle: chapter.title,
      paragraphIndex: selectedParagraphIndex,
      paragraphText: currentParagraphText,
      selection: noteSelectionSnapshot,
      body: noteDraft,
      dictionaryEntries: noteDictionarySnapshot,
    });
    closeNoteComposer();
    setSelection(null);
  }

  function deleteEditingNote() {
    if (!editingNoteId) {
      return;
    }

    removeNote(editingNoteId);
    closeNoteComposer();
    setSelection(null);
  }

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
        <View style={styles.headerStrip}>
          <View style={styles.heroCopy}>
            <ThemedText style={[styles.chapterEyebrow, { color: chromeText }]}>
              Chapter {chapterIndex + 1}
            </ThemedText>
            <ThemedText style={[styles.chapterTitle, { color: textColor }]}>
              {chapter.title}
            </ThemedText>
            <ThemedText style={[styles.bookTitle, { color: chromeText }]}>
              {book.title}
            </ThemedText>
          </View>
          <Pressable
            onPress={toggleBookmark}
            style={[
              styles.headerActionButton,
              {
                borderColor: panelBorder,
                backgroundColor: currentBookmark ? accentSoft : "transparent",
              },
            ]}
          >
            <Text style={[styles.headerActionText, { color: textColor }]}>
              {currentBookmark ? "Bookmarked" : "Bookmark"}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.readingViewport,
            {
              height: readingViewportHeight,
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={[
              styles.readingViewportScroll,
              readingPanelStyle,
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {paragraphUnits.map(({ paragraph, units }, index) => (
              <Pressable
                key={`${chapter.id}-${index}`}
                onPress={() => selectParagraph(index)}
                style={styles.paragraphBlock}
              >
                <View style={[styles.paragraphRow, paragraphRowStyle]}>
                  {units.map((unit) => {
                    const token = unit.token;
                    const isHighlighted = getTokenHighlightState({
                      paragraphIndex: index,
                      selectedParagraphIndex,
                      selection,
                      token,
                    });
                    const noteMarkers =
                      index === selectedParagraphIndex
                        ? getTokenNoteMarkers(token, noteAnnotatedRanges)
                        : null;
                    const rubyColor =
                      unit.rubySource === "dictionary"
                        ? rubyDictionaryColor
                        : rubyBookColor;

                    return (
                      <Pressable
                        key={`${index}-${token.start}-${token.end}-${token.surface}`}
                        onPress={() =>
                          handleTokenPress(index, paragraph, token)
                        }
                        style={[
                          styles.inlineUnit,
                          unit.needsSideSpacing && styles.inlineUnitWithSpacing,
                          isHighlighted.sentence && {
                            backgroundColor: sentenceHighlightColor,
                          },
                          isHighlighted.token && {
                            backgroundColor: tokenHighlightColor,
                          },
                        ]}
                      >
                        <View style={styles.inlineUnitContent}>
                          {unit.rubyText ? (
                            <View style={styles.rubyUnit}>
                              <Text
                                style={[
                                  styles.rubyText,
                                  rubyTextStyle,
                                  { color: rubyColor },
                                ]}
                              >
                                {unit.rubyText}
                              </Text>
                              <Text
                                style={[
                                  styles.baseText,
                                  baseTextStyle,
                                  { color: textColor },
                                ]}
                              >
                                {token.surface}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.baseTokenWrap}>
                              <Text
                                style={[
                                  styles.baseText,
                                  baseTextStyle,
                                  {
                                    color: textColor,
                                    opacity:
                                      index === selectedParagraphIndex ? 1 : 0.92,
                                  },
                                ]}
                              >
                                {token.surface}
                              </Text>
                            </View>
                          )}
                          {noteMarkers?.hasSentenceNote ? (
                            <View
                              style={[
                                styles.sentenceNoteUnderline,
                                noteMarkers.isSentenceStart &&
                                  styles.sentenceNoteUnderlineStart,
                                noteMarkers.isSentenceEnd &&
                                  styles.sentenceNoteUnderlineEnd,
                              ]}
                            />
                          ) : null}
                          {noteMarkers?.hasTokenNote ? (
                            <View style={styles.tokenNoteUnderline} />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      <ReaderSettingsModal
        visible={isSettingsVisible}
        overlayColor={overlayColor}
        panelColor={panelColor}
        panelBorder={panelBorder}
        dockShadow={dockShadow}
        textColor={textColor}
        chromeText={chromeText}
        accentSoft={accentSoft}
        fontFamily={appearanceSettings.fontFamily}
        fontSize={appearanceSettings.fontSize}
        lineHeight={appearanceSettings.lineHeight}
        paragraphGap={appearanceSettings.paragraphGap}
        horizontalInset={appearanceSettings.horizontalInset}
        verticalInset={appearanceSettings.verticalInset}
        onClose={() => setIsSettingsVisible(false)}
        onChangeFontFamily={(fontFamily) => setAppearanceSettings({ fontFamily })}
        onChangeFontSize={(fontSize) => setAppearanceSettings({ fontSize })}
        onChangeLineHeight={(lineHeight) => setAppearanceSettings({ lineHeight })}
        onChangeParagraphGap={(paragraphGap) => setAppearanceSettings({ paragraphGap })}
        onChangeHorizontalInset={(horizontalInset) =>
          setAppearanceSettings({ horizontalInset })
        }
        onChangeVerticalInset={(verticalInset) =>
          setAppearanceSettings({ verticalInset })
        }
      />

      <ReaderLookupModal
        visible={isLookupVisible}
        selection={selection}
        dictionaryEntries={dictionaryEntries}
        selectionNote={activeSelectionNote}
        overlayColor={overlayColor}
        panelBorder={panelBorder}
        modalCardColor={modalCardColor}
        modalTextColor={modalTextColor}
        chromeText={chromeText}
        rubyBookColor={rubyBookColor}
        rubyDictionaryColor={rubyDictionaryColor}
        modalAnimatedStyle={modalAnimatedStyle}
        dragHandleAnimatedStyle={dragHandleAnimatedStyle}
        resizeHandleAnimatedStyle={resizeHandleAnimatedStyle}
        dragGesture={dragGesture}
        resizeGesture={resizeGesture}
        onClose={closeLookup}
        onOpenNoteComposer={openNoteComposer}
        onOpenNoteEditor={openNoteEditor}
      />

      <ReaderNoteComposerModal
        visible={isNoteComposerVisible}
        overlayColor={overlayColor}
        panelColor={panelColor}
        panelBorder={panelBorder}
        dockShadow={dockShadow}
        textColor={textColor}
        chromeText={chromeText}
        accentSoft={accentSoft}
        modalCardColor={modalCardColor}
        title={editingNoteId ? "Edit Reader Note" : "Linked Reader Note"}
        selectionText={noteSelectionSnapshot?.text ?? ""}
        dictionarySnapshot={noteDictionarySnapshot}
        noteDraft={noteDraft}
        canSave={Boolean(noteSelectionSnapshot && noteDraft.trim())}
        isEditing={Boolean(editingNoteId)}
        onChangeNoteDraft={setNoteDraft}
        onClose={closeNoteComposer}
        onSave={saveNote}
        onDelete={deleteEditingNote}
      />
    </ThemedView>
  );

  function handleTokenPress(
    paragraphIndex: number,
    paragraph: ReaderParagraph,
    token: ReaderToken,
  ) {
    const now = Date.now();
    const lastTap = lastTapRef.current;
    const tokenSelected =
      paragraphIndex === selectedParagraphIndex &&
      isSameTokenSelection(selection, token);
    const sentenceSelected =
      paragraphIndex === selectedParagraphIndex &&
      isTokenInsideSentenceSelection(selection, token);
    const isDoubleTap =
      lastTap &&
      lastTap.paragraphIndex === paragraphIndex &&
      lastTap.tokenStart === token.start &&
      lastTap.tokenEnd === token.end &&
      now - lastTap.time <= DOUBLE_TAP_DELAY_MS;

    if (pendingTapRef.current) {
      clearTimeout(pendingTapRef.current);
      pendingTapRef.current = null;
    }

    selectParagraph(paragraphIndex);

    if (isDoubleTap) {
      if (pendingTapRef.current) {
        clearTimeout(pendingTapRef.current);
        pendingTapRef.current = null;
      }
      lastTapRef.current = null;
      setSelection(buildSentenceSelection(paragraph.text, token));
      setIsLookupVisible(true);
      return;
    }

    if (tokenSelected || sentenceSelected) {
      lastTapRef.current = {
        paragraphIndex,
        tokenStart: token.start,
        tokenEnd: token.end,
        time: now,
      };
      pendingTapRef.current = setTimeout(() => {
        lastTapRef.current = null;
        pendingTapRef.current = null;
        setSelection(null);
        setIsLookupVisible(false);
      }, DOUBLE_TAP_DELAY_MS);
      return;
    }

    lastTapRef.current = {
      paragraphIndex,
      tokenStart: token.start,
      tokenEnd: token.end,
      time: now,
    };
    pendingTapRef.current = setTimeout(() => {
      pendingTapRef.current = null;
      setSelection({ type: "token", token });
      setIsLookupVisible(true);
    }, DOUBLE_TAP_DELAY_MS);
  }
}
