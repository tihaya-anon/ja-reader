import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";
import type { ReaderParagraph } from "@/data/book-data";
import {
  useReaderAnnotations,
  type ReaderSelectionSnapshot,
} from "@/features/reader/reader-annotations-context";
import {
  getDictionaryEntriesForToken,
  getRubyTextForSurface,
  resolveDictionaryRuby,
} from "@/features/reader/lookup";
import { tokenizeReaderParagraph } from "@/features/reader/paragraph";
import {
  useReaderChrome,
  useSetReaderChromeNavigation,
} from "@/features/reader/reader-chrome-context";
import { useReaderState } from "@/features/reader/reader-state-context";
import type { ReaderToken } from "@/features/reader/tokenize";
import { useReaderSettings } from "@/features/reader/use-reader-settings";
import { useThemeColor } from "@/hooks/use-theme-color";

type ReaderSelection =
  | {
      type: "token";
      token: ReaderToken;
    }
  | {
      type: "sentence";
      text: string;
      start: number;
      end: number;
    };

type RubySource = "book" | "dictionary";

type ParagraphUnit = {
  token: ReaderToken;
  rubyText?: string;
  rubySource?: RubySource;
  needsSideSpacing?: boolean;
};

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
    removeBookmark,
  } = useReaderAnnotations();
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [isLookupVisible, setIsLookupVisible] = useState(false);
  const [isNoteComposerVisible, setIsNoteComposerVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
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
    setNoteDraft("");
    setIsNoteComposerVisible(true);
  }

  function saveNote() {
    if (!selectionSnapshot || !noteDraft.trim()) {
      return;
    }

    addNote({
      chapterIndex,
      chapterTitle: chapter.title,
      paragraphIndex: selectedParagraphIndex,
      paragraphText: currentParagraphText,
      selection: selectionSnapshot,
      body: noteDraft,
      dictionaryEntries,
    });
    setNoteDraft("");
    setIsNoteComposerVisible(false);
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

        {paragraphNotes.length > 0 ? (
          <View
            style={[
              styles.annotationStrip,
              { borderColor: panelBorder, backgroundColor: panelColor },
            ]}
          >
            <ThemedText style={[styles.annotationStripTitle, { color: textColor }]}>
              {paragraphNotes.length} note{paragraphNotes.length > 1 ? "s" : ""} on this paragraph
            </ThemedText>
            <ThemedText style={[styles.annotationStripMeta, { color: chromeText }]}>
              Latest: {paragraphNotes[0]?.title}
            </ThemedText>
          </View>
        ) : null}

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
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isSettingsVisible}
        onRequestClose={() => setIsSettingsVisible(false)}
      >
        <View style={styles.settingsModalRoot}>
          <Pressable
            style={[styles.modalBackdrop, { backgroundColor: overlayColor }]}
            onPress={() => setIsSettingsVisible(false)}
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
                <ThemedText
                  style={[styles.chapterEyebrow, { color: chromeText }]}
                >
                  Reader
                </ThemedText>
                <ThemedText
                  style={[styles.settingsSheetTitle, { color: textColor }]}
                >
                  Reading Layout
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setIsSettingsVisible(false)}
                style={[styles.focusReturnButton, { borderColor: panelBorder }]}
              >
                <Text style={[styles.sheetActionText, { color: textColor }]}>
                  Done
                </Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.settingsPanel}>
              <View style={styles.settingsRow}>
                <ThemedText
                  style={[styles.settingsLabel, { color: chromeText }]}
                >
                  Font
                </ThemedText>
                <View style={styles.choiceRow}>
                  {(
                    [
                      ["serif", "Serif"],
                      ["rounded", "Rounded"],
                      ["sans", "Sans"],
                    ] as const
                  ).map(([fontFamily, label]) => (
                    <Pressable
                      key={fontFamily}
                      onPress={() => setAppearanceSettings({ fontFamily })}
                      style={[
                        styles.choiceChip,
                        {
                          borderColor: panelBorder,
                          backgroundColor:
                            appearanceSettings.fontFamily === fontFamily
                              ? accentSoft
                              : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={[styles.choiceChipText, { color: textColor }]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <SettingsStepper
                label="Size"
                value={appearanceSettings.fontSize}
                decrementLabel="A-"
                incrementLabel="A+"
                onDecrement={() =>
                  setAppearanceSettings({
                    fontSize: appearanceSettings.fontSize - 2,
                  })
                }
                onIncrement={() =>
                  setAppearanceSettings({
                    fontSize: appearanceSettings.fontSize + 2,
                  })
                }
                borderColor={panelBorder}
                textColor={textColor}
                chromeText={chromeText}
              />

              <SettingsStepper
                label="Leading"
                value={appearanceSettings.lineHeight}
                onDecrement={() =>
                  setAppearanceSettings({
                    lineHeight: appearanceSettings.lineHeight - 2,
                  })
                }
                onIncrement={() =>
                  setAppearanceSettings({
                    lineHeight: appearanceSettings.lineHeight + 2,
                  })
                }
                borderColor={panelBorder}
                textColor={textColor}
                chromeText={chromeText}
              />

              <SettingsStepper
                label="Paragraph Gap"
                value={appearanceSettings.paragraphGap}
                onDecrement={() =>
                  setAppearanceSettings({
                    paragraphGap: appearanceSettings.paragraphGap - 2,
                  })
                }
                onIncrement={() =>
                  setAppearanceSettings({
                    paragraphGap: appearanceSettings.paragraphGap + 2,
                  })
                }
                borderColor={panelBorder}
                textColor={textColor}
                chromeText={chromeText}
              />

              <SettingsStepper
                label="Horizontal Inset"
                value={appearanceSettings.horizontalInset}
                decrementLabel="-"
                incrementLabel="+"
                onDecrement={() =>
                  setAppearanceSettings({
                    horizontalInset: appearanceSettings.horizontalInset - 4,
                  })
                }
                onIncrement={() =>
                  setAppearanceSettings({
                    horizontalInset: appearanceSettings.horizontalInset + 4,
                  })
                }
                borderColor={panelBorder}
                textColor={textColor}
                chromeText={chromeText}
              />

              <SettingsStepper
                label="Viewport Inset"
                value={appearanceSettings.verticalInset}
                decrementLabel="-"
                incrementLabel="+"
                onDecrement={() =>
                  setAppearanceSettings({
                    verticalInset: appearanceSettings.verticalInset - 4,
                  })
                }
                onIncrement={() =>
                  setAppearanceSettings({
                    verticalInset: appearanceSettings.verticalInset + 4,
                  })
                }
                borderColor={panelBorder}
                textColor={textColor}
                chromeText={chromeText}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isLookupVisible}
        onRequestClose={closeLookup}
      >
        <GestureHandlerRootView style={styles.modalRoot}>
          <View pointerEvents="box-none" style={styles.modalRoot}>
            <Pressable
              style={[styles.modalBackdrop, { backgroundColor: overlayColor }]}
              onPress={closeLookup}
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
              <View
                style={[styles.modalHeader, { borderBottomColor: panelBorder }]}
              >
                <View style={styles.modalHeaderCopy}>
                  <ThemedText
                    style={[styles.modalTitle, { color: modalTextColor }]}
                  >
                    {selection?.type === "token"
                      ? selection.token.surface
                      : "Sentence"}
                  </ThemedText>
                  <ThemedText style={[styles.modalMeta, { color: chromeText }]}>
                    {selection?.type === "token"
                      ? buildTokenMeta(selection.token)
                      : "Double-tap to select a sentence"}
                  </ThemedText>
                </View>
                <GestureDetector gesture={dragGesture}>
                  <Animated.View
                    style={[
                      styles.modalHandle,
                      dragHandleAnimatedStyle,
                      undefined,
                    ]}
                  >
                    <View
                      style={[
                        styles.modalHandleBar,
                        { backgroundColor: chromeText },
                      ]}
                    />
                    <View
                      style={[
                        styles.modalHandleBar,
                        { backgroundColor: chromeText },
                      ]}
                    />
                  </Animated.View>
                </GestureDetector>
              </View>
              <ScrollView contentContainerStyle={styles.modalBody}>
                <View style={styles.lookupActions}>
                  <Pressable
                    onPress={toggleBookmark}
                    style={[
                      styles.lookupActionButton,
                      {
                        borderColor: panelBorder,
                        backgroundColor: currentBookmark ? accentSoft : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.lookupActionText, { color: modalTextColor }]}>
                      {currentBookmark ? "Remove bookmark" : "Add bookmark"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={openNoteComposer}
                    style={[
                      styles.lookupActionButton,
                      { borderColor: panelBorder, backgroundColor: "transparent" },
                    ]}
                  >
                    <Text style={[styles.lookupActionText, { color: modalTextColor }]}>
                      Add note
                    </Text>
                  </Pressable>
                </View>

                {selection?.type === "sentence" ? (
                  <ThemedText
                    style={[styles.sentenceText, { color: modalTextColor }]}
                  >
                    {selection.text}
                  </ThemedText>
                ) : dictionaryEntries.length > 0 ? (
                  <>
                    <View style={styles.rubyLegend}>
                      <View style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: rubyBookColor },
                          ]}
                        />
                        <ThemedText
                          style={[styles.legendText, { color: chromeText }]}
                        >
                          EPUB ruby
                        </ThemedText>
                      </View>
                      <View style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: rubyDictionaryColor },
                          ]}
                        />
                        <ThemedText
                          style={[styles.legendText, { color: chromeText }]}
                        >
                          Dictionary ruby
                        </ThemedText>
                      </View>
                    </View>
                    {dictionaryEntries.map((entry) => (
                      <View
                        key={`${entry.key}-${entry.definition.slice(0, 40)}`}
                        style={styles.entryBlock}
                      >
                        <ThemedText
                          style={[styles.entryKey, { color: modalTextColor }]}
                        >
                          {entry.key}
                          {entry.reading ? ` · ${entry.reading}` : ""}
                        </ThemedText>
                        <Text
                          selectable
                          style={[
                            styles.entryDefinition,
                            { color: modalTextColor },
                          ]}
                        >
                          {stripDefinitionHtml(entry.definition)}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <ThemedText
                    style={[styles.emptyStateText, { color: chromeText }]}
                  >
                    No local dictionary entry for this token yet.
                  </ThemedText>
                )}

                {selectionNotes.length > 0 ? (
                  <View style={styles.notesSection}>
                    <ThemedText style={[styles.notesSectionTitle, { color: modalTextColor }]}>
                      Notes
                    </ThemedText>
                    {selectionNotes.map((note) => (
                      <View
                        key={note.id}
                        style={[
                          styles.noteCard,
                          { borderColor: panelBorder, backgroundColor: panelColor },
                        ]}
                      >
                        <ThemedText style={[styles.noteTitle, { color: modalTextColor }]}>
                          {note.title}
                        </ThemedText>
                        <ThemedText style={[styles.noteBody, { color: modalTextColor }]}>
                          {note.body}
                        </ThemedText>
                        <ThemedText style={[styles.noteMeta, { color: chromeText }]}>
                          AI ready · {note.aiContext.tags.join(" · ")}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </ScrollView>

              <GestureDetector gesture={resizeGesture}>
                <Animated.View
                  style={[
                    styles.resizeHandle,
                    resizeHandleAnimatedStyle,
                    undefined,
                  ]}
                >
                  <View
                    style={[styles.resizeGrip, { borderColor: chromeText }]}
                  />
                  <View
                    style={[
                      styles.resizeGripSecondary,
                      { borderColor: chromeText },
                    ]}
                  />
                </Animated.View>
              </GestureDetector>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={isNoteComposerVisible}
        onRequestClose={() => setIsNoteComposerVisible(false)}
      >
        <View style={styles.settingsModalRoot}>
          <Pressable
            style={[styles.modalBackdrop, { backgroundColor: overlayColor }]}
            onPress={() => setIsNoteComposerVisible(false)}
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
                  Notes
                </ThemedText>
                <ThemedText style={[styles.settingsSheetTitle, { color: textColor }]}>
                  Linked Reader Note
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setIsNoteComposerVisible(false)}
                style={[styles.focusReturnButton, { borderColor: panelBorder }]}
              >
                <Text style={[styles.sheetActionText, { color: textColor }]}>Close</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.noteComposerContent}>
              <View style={styles.noteContextBlock}>
                <ThemedText style={[styles.settingsLabel, { color: chromeText }]}>
                  Selection
                </ThemedText>
                <ThemedText style={[styles.noteSelectionText, { color: textColor }]}>
                  {selectionSnapshot?.text ?? "No active selection"}
                </ThemedText>
              </View>

              {dictionaryEntries.length > 0 ? (
                <View style={styles.noteContextBlock}>
                  <ThemedText style={[styles.settingsLabel, { color: chromeText }]}>
                    Dictionary Snapshot
                  </ThemedText>
                  <ThemedText style={[styles.noteDictionaryText, { color: textColor }]}>
                    {dictionaryEntries[0]?.key}
                    {dictionaryEntries[0]?.reading ? ` · ${dictionaryEntries[0].reading}` : ""}
                    {"\n"}
                    {stripDefinitionHtml(dictionaryEntries[0]?.definition ?? "")}
                  </ThemedText>
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
                  onChangeText={setNoteDraft}
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
                  Saved notes keep the selected text, dictionary snapshot, and prompt seed so later AI explain/quiz/rewrite actions can reuse them.
                </ThemedText>
              </View>

              <Pressable
                onPress={saveNote}
                disabled={!selectionSnapshot || !noteDraft.trim()}
                style={[
                  styles.noteSaveButton,
                  {
                    borderColor: panelBorder,
                    backgroundColor: noteDraft.trim() ? accentSoft : "transparent",
                    opacity: !selectionSnapshot || !noteDraft.trim() ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.sheetActionText, { color: textColor }]}>Save note</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
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

function buildParagraphUnits(
  paragraph: ReaderParagraph,
  chapterTokens: ReaderToken[][],
  paragraphIndex: number,
  chapterRubyMap: Map<string, string>,
): ParagraphUnit[] {
  const tokens = tokenizeReaderParagraph(
    paragraph,
    chapterTokens,
    paragraphIndex,
  );
  const units: ParagraphUnit[] = [];

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];

    if (token.wordType === "RUBY" && token.reading) {
      units.push({
        token,
        rubyText: token.reading,
        rubySource: "book",
        needsSideSpacing: shouldAddRubySpacing(token.surface, token.reading),
      });
      continue;
    }

    const mergedUnit = findMergedParagraphUnit(
      tokens,
      tokenIndex,
      chapterRubyMap,
    );
    if (mergedUnit) {
      units.push(mergedUnit.unit);
      tokenIndex += mergedUnit.length - 1;
      continue;
    }

    const entries = getDictionaryEntriesForToken(token);
    const ruby = resolveDictionaryRuby(token, entries);

    units.push(
      ruby
        ? {
            token,
            rubyText: ruby,
            rubySource: "dictionary",
            needsSideSpacing: shouldAddRubySpacing(token.surface, ruby),
          }
        : {
            token,
          },
    );
  }

  return units;
}

function buildChapterRubyMap(paragraphs: ReaderParagraph[]) {
  const rubyMap = new Map<string, string>();

  for (const paragraph of paragraphs) {
    for (const segment of paragraph.segments) {
      if (segment.type !== "ruby") {
        continue;
      }

      if (!rubyMap.has(segment.base)) {
        rubyMap.set(segment.base, segment.reading);
      }
    }
  }

  return rubyMap;
}

function findMergedParagraphUnit(
  tokens: ReaderToken[],
  startIndex: number,
  chapterRubyMap: Map<string, string>,
) {
  const maxGroupLength = Math.min(4, tokens.length - startIndex);

  for (let groupLength = maxGroupLength; groupLength >= 2; groupLength -= 1) {
    const group = tokens.slice(startIndex, startIndex + groupLength);
    if (!canMergeTokenGroup(group)) {
      continue;
    }

    const surface = group.map((token) => token.surface).join("");
    const bookRuby = chapterRubyMap.get(surface);
    if (bookRuby) {
      return {
        length: groupLength,
        unit: {
          token: buildMergedToken(group, surface, bookRuby),
          rubyText: bookRuby,
          rubySource: "book" as const,
          needsSideSpacing: shouldAddRubySpacing(surface, bookRuby),
        },
      };
    }

    const dictionaryRuby = getRubyTextForSurface(surface);
    if (dictionaryRuby) {
      return {
        length: groupLength,
        unit: {
          token: buildMergedToken(group, surface, dictionaryRuby),
          rubyText: dictionaryRuby,
          rubySource: "dictionary" as const,
          needsSideSpacing: shouldAddRubySpacing(surface, dictionaryRuby),
        },
      };
    }
  }

  return null;
}

function canMergeTokenGroup(tokens: ReaderToken[]) {
  if (tokens.length < 2) {
    return false;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (
      token.wordType === "RUBY" ||
      token.pos === "記号" ||
      !token.surface.trim()
    ) {
      return false;
    }

    const nextToken = tokens[index + 1];
    if (nextToken && token.end !== nextToken.start) {
      return false;
    }
  }

  return true;
}

function buildMergedToken(
  tokens: ReaderToken[],
  surface: string,
  reading: string,
): ReaderToken {
  const firstToken = tokens[0];
  const lastToken = tokens.at(-1) ?? firstToken;

  return {
    surface,
    start: firstToken.start,
    end: lastToken.end,
    basicForm: surface,
    reading,
    pronunciation: reading,
    pos: firstToken.pos,
    posDetail1: firstToken.posDetail1,
    posDetail2: firstToken.posDetail2,
    posDetail3: firstToken.posDetail3,
    wordType: "MERGED",
  };
}

function shouldAddRubySpacing(surface: string, rubyText: string) {
  const trimmedSurface = surface.trim();
  const trimmedRuby = rubyText.trim();

  if (!trimmedSurface || !trimmedRuby) {
    return false;
  }

  return estimateRubyWidth(trimmedRuby) > estimateBaseWidth(trimmedSurface);
}

function estimateRubyWidth(text: string) {
  let width = 0;

  for (const char of text) {
    width += isNarrowKana(char) ? 0.55 : 1;
  }

  return width;
}

function estimateBaseWidth(text: string) {
  let width = 0;

  for (const char of text) {
    width += isWideJapaneseGlyph(char) ? 1 : 0.7;
  }

  return width;
}

function isNarrowKana(char: string) {
  return "ゃゅょぁぃぅぇぉっャュョァィゥェォッヮゎ".includes(char);
}

function isWideJapaneseGlyph(char: string) {
  return /[一-龯々ぁ-ゖァ-ヺー]/u.test(char);
}

function getTokenHighlightState({
  paragraphIndex,
  selectedParagraphIndex,
  selection,
  token,
}: {
  paragraphIndex: number;
  selectedParagraphIndex: number;
  selection: ReaderSelection | null;
  token: ReaderToken;
}) {
  const tokenSelected =
    paragraphIndex === selectedParagraphIndex &&
    isSameTokenSelection(selection, token);
  const sentenceSelected =
    paragraphIndex === selectedParagraphIndex &&
    isTokenInsideSentenceSelection(selection, token);

  return {
    token: tokenSelected,
    sentence: sentenceSelected,
  };
}

function isSameTokenSelection(
  selection: ReaderSelection | null,
  token: ReaderToken,
) {
  return (
    selection?.type === "token" &&
    selection.token.start === token.start &&
    selection.token.end === token.end &&
    selection.token.pos === token.pos &&
    selection.token.surface === token.surface
  );
}

function isTokenInsideSentenceSelection(
  selection: ReaderSelection | null,
  token: ReaderToken,
) {
  return (
    selection?.type === "sentence" &&
    token.start >= selection.start &&
    token.end <= selection.end
  );
}

function buildTokenMeta(token: ReaderToken) {
  const parts = [
    token.basicForm,
    token.reading ? toHiragana(token.reading) : undefined,
    token.pos,
  ].filter(Boolean);
  return parts.join(" · ");
}

function stripDefinitionHtml(definition: string) {
  return definition
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSentenceSelection(
  paragraph: string,
  token: ReaderToken,
): ReaderSelection {
  const sentenceRange = findSentenceRange(paragraph, token.start, token.end);

  return {
    type: "sentence",
    text: paragraph.slice(sentenceRange.start, sentenceRange.end).trim(),
    start: sentenceRange.start,
    end: sentenceRange.end,
  };
}

function toSelectionSnapshot(selection: ReaderSelection): ReaderSelectionSnapshot {
  if (selection.type === "sentence") {
    return selection;
  }

  return {
    type: "token",
    text: selection.token.surface,
    start: selection.token.start,
    end: selection.token.end,
    pos: selection.token.pos,
    basicForm: selection.token.basicForm,
    reading: selection.token.reading ? toHiragana(selection.token.reading) : undefined,
  };
}

function findSentenceRange(text: string, tokenStart: number, tokenEnd: number) {
  const delimiters = /[。！？!?]/u;
  let start = tokenStart;
  let end = tokenEnd;

  while (start > 0) {
    if (delimiters.test(text[start - 1])) {
      break;
    }
    start -= 1;
  }

  while (end < text.length) {
    if (delimiters.test(text[end])) {
      end += 1;
      break;
    }
    end += 1;
  }

  return { start, end };
}

function clampModalSettings(
  settings: { x: number; y: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
) {
  "worklet";

  const width = Math.min(
    Math.max(settings.width, 240),
    Math.max(240, viewportWidth - 24),
  );
  const height = Math.min(
    Math.max(settings.height, 180),
    Math.max(180, viewportHeight - 80),
  );

  return {
    width,
    height,
    x: Math.min(
      Math.max(settings.x, 12),
      Math.max(12, viewportWidth - width - 12),
    ),
    y: Math.min(
      Math.max(settings.y, 72),
      Math.max(72, viewportHeight - height - 12),
    ),
  };
}

function toHiragana(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.replace(/[ァ-ヶ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

function summarizeExcerpt(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 80 ? `${compact.slice(0, 80)}…` : compact;
}

function SettingsStepper({
  label,
  value,
  onDecrement,
  onIncrement,
  borderColor,
  textColor,
  chromeText,
  decrementLabel = "-",
  incrementLabel = "+",
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  borderColor: string;
  textColor: string;
  chromeText: string;
  decrementLabel?: string;
  incrementLabel?: string;
}) {
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingTop: 24,
    gap: 20,
    userSelect: "none",
  },
  headerStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  chapterEyebrow: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  chapterTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 30,
    lineHeight: 36,
  },
  bookTitle: {
    fontFamily: Fonts.serif,
    fontSize: 14,
    lineHeight: 20,
  },
  headerActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerActionText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 16,
  },
  annotationStrip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  annotationStripTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 18,
  },
  annotationStripMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  readingPanel: {
    userSelect: "none",
  },
  paragraphBlock: {
    borderRadius: 12,
  },
  paragraphRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    rowGap: 12,
  },
  inlineUnit: {
    borderRadius: 8,
    justifyContent: "flex-end",
    userSelect: "none",
  },
  inlineUnitWithSpacing: {
    marginHorizontal: 4,
  },
  rubyUnit: {
    alignItems: "center",
    gap: 1,
    minHeight: 42,
  },
  rubyText: {
    fontFamily: Fonts.rounded,
    fontSize: 11,
    lineHeight: 13,
  },
  baseText: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 38,
  },
  focusReturnButton: {
    minWidth: 72,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  sheetActionText: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  settingsModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  settingsSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 14,
  },
  settingsSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  settingsSheetTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 26,
    lineHeight: 32,
  },
  settingsPanel: {
    gap: 12,
  },
  settingsRow: {
    gap: 8,
  },
  settingsLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    lineHeight: 16,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceChipText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 16,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperButton: {
    minWidth: 54,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  stepperText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 16,
  },
  stepperValue: {
    minWidth: 36,
    textAlign: "center",
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 18,
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  lookupModal: {
    position: "absolute",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },
  modalTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
    lineHeight: 24,
  },
  modalMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalHandle: {
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
    minHeight: 24,
    minWidth: 28,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  modalHandleBar: {
    borderRadius: 999,
    height: 3,
    width: 18,
    opacity: 0.65,
  },
  modalBody: {
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 42,
    paddingTop: 14,
  },
  lookupActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  lookupActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lookupActionText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 16,
  },
  rubyLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  legendDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendText: {
    fontSize: 12,
    lineHeight: 16,
  },
  sentenceText: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 29,
  },
  entryBlock: {
    gap: 8,
  },
  entryKey: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    lineHeight: 21,
  },
  entryDefinition: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    lineHeight: 25,
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  notesSection: {
    gap: 10,
  },
  notesSectionTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    lineHeight: 20,
  },
  noteCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  noteTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 18,
  },
  noteBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  noteMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  noteComposerContent: {
    gap: 14,
  },
  noteContextBlock: {
    gap: 8,
  },
  noteSelectionText: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 28,
  },
  noteDictionaryText: {
    fontSize: 14,
    lineHeight: 22,
  },
  noteInput: {
    minHeight: 148,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.serif,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  noteAiHint: {
    fontSize: 13,
    lineHeight: 20,
  },
  noteSaveButton: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  resizeHandle: {
    position: "absolute",
    right: 10,
    bottom: 10,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    height: 28,
    width: 28,
  },
  resizeGrip: {
    height: 18,
    width: 18,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomRightRadius: 14,
  },
  resizeGripSecondary: {
    position: "absolute",
    right: 2,
    bottom: 2,
    height: 10,
    width: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderBottomRightRadius: 9,
  },
  readingViewport: {
    overflow: "hidden",
  },
  readingViewportScroll: {
    paddingBottom: 36,
  },
});
