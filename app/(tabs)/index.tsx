import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

import type { ReaderParagraph } from '@/data/book-data';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import {
  getDictionaryEntriesForToken,
  getRubyTextForSurface,
  resolveDictionaryRuby,
} from '@/features/reader/lookup';
import { tokenizeReaderParagraph } from '@/features/reader/paragraph';
import { useReaderSettings } from '@/features/reader/use-reader-settings';
import type { ReaderToken } from '@/features/reader/tokenize';
import { useReaderState } from '@/features/reader/use-reader-state';
import { useThemeColor } from '@/hooks/use-theme-color';

type ReaderSelection =
  | {
      type: 'token';
      token: ReaderToken;
    }
  | {
      type: 'sentence';
      text: string;
      start: number;
      end: number;
    };

type RubySource = 'book' | 'dictionary';

type ParagraphUnit = {
  token: ReaderToken;
  rubyText?: string;
  rubySource?: RubySource;
};

const DOUBLE_TAP_DELAY_MS = 380;
const TOOL_BUTTON_SIZE = 56;

export default function ReaderScreen() {
  const {
    book,
    chapter,
    chapterIndex,
    chapterTokens,
    paragraphProgress,
    selectedParagraph,
    selectedParagraphIndex,
    selectedTokens,
    readingProgress,
    canGoNextChapter,
    canGoPreviousChapter,
    goToNextChapter,
    goToPreviousChapter,
    selectParagraph,
  } = useReaderState();
  const { modalSettings, setModalSettings } = useReaderSettings();
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [isLookupVisible, setIsLookupVisible] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<
    { paragraphIndex: number; tokenStart: number; tokenEnd: number; time: number } | null
  >(null);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const resizeStartWidth = useSharedValue(0);
  const resizeStartHeight = useSharedValue(0);
  const dragHandleActive = useSharedValue(0);
  const resizeHandleActive = useSharedValue(0);

  const selectedToken = selection?.type === 'token' ? selection.token : null;
  const dictionaryEntries = useMemo(
    () => getDictionaryEntriesForToken(selectedToken),
    [selectedToken]
  );

  const chapterRubyMap = useMemo(() => buildChapterRubyMap(chapter.paragraphs), [chapter.paragraphs]);

  const paragraphUnits = useMemo(
    () =>
      chapter.paragraphs.map((paragraph, paragraphIndex) => ({
        paragraph,
        units: buildParagraphUnits(paragraph, chapterTokens, paragraphIndex, chapterRubyMap),
      })),
    [chapter.paragraphs, chapterRubyMap, chapterTokens]
  );

  const textColor = useThemeColor({ light: '#201A14', dark: '#F6F0E3' }, 'text');
  const pageBackground = useThemeColor({ light: '#F4E7CF', dark: '#171A19' }, 'background');
  const panelColor = useThemeColor({ light: '#FBF5EA', dark: '#202523' }, 'background');
  const panelBorder = useThemeColor({ light: '#D7C3A0', dark: '#3D4641' }, 'icon');
  const chromeText = useThemeColor({ light: '#6B5B42', dark: '#B8A98C' }, 'icon');
  const progressTrack = useThemeColor({ light: '#E5D5B9', dark: '#2B312E' }, 'background');
  const progressFill = useThemeColor({ light: '#AE6C37', dark: '#C89258' }, 'tint');
  const tokenHighlightColor = useThemeColor({ light: '#D7B98B', dark: '#5A503F' }, 'background');
  const sentenceHighlightColor = useThemeColor({ light: '#EFE2C8', dark: '#2B312A' }, 'background');
  const rubyBookColor = useThemeColor({ light: '#9B4D2F', dark: '#E3A66C' }, 'tint');
  const rubyDictionaryColor = useThemeColor({ light: '#466C9B', dark: '#7DB2E8' }, 'icon');
  const fabBackground = useThemeColor({ light: '#171411', dark: '#EFE3CB' }, 'text');
  const fabForeground = useThemeColor({ light: '#F9F0DE', dark: '#171411' }, 'background');
  const overlayColor = useThemeColor({ light: 'rgba(23, 18, 12, 0.18)', dark: 'rgba(8, 9, 8, 0.42)' }, 'background');
  const modalCardColor = useThemeColor({ light: '#FFF8EC', dark: '#1D211F' }, 'background');
  const modalTextColor = useThemeColor({ light: '#32281C', dark: '#F0E7D5' }, 'text');

  const clampedModalSettings = useMemo(
    () => clampModalSettings(modalSettings, viewportWidth, viewportHeight),
    [modalSettings, viewportHeight, viewportWidth]
  );

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

      if (currentSelection.type === 'token') {
        const nextToken = selectedTokens.find(
          (token) =>
            token.start === currentSelection.token.start &&
            token.end === currentSelection.token.end &&
            token.pos === currentSelection.token.pos &&
            token.surface === currentSelection.token.surface
        );

        return nextToken
          ? { type: 'token', token: nextToken }
          : null;
      }

      return currentSelection.end <= selectedParagraph.text.length
        ? currentSelection
        : null;
    });
  }, [selectedParagraph, selectedTokens]);

  useEffect(() => {
    if (selection?.type === 'token') {
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

  const modalAnimatedStyle = useAnimatedStyle(
    () => ({
      left: clampedModalSettings.x,
      top: clampedModalSettings.y,
      width: clampedModalSettings.width,
      height: clampedModalSettings.height,
    }),
    [clampedModalSettings]
  );

  const dragHandleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dragHandleActive.value ? 0.82 : 1, { duration: 120 }),
    transform: [{ scale: withTiming(dragHandleActive.value ? 0.96 : 1, { duration: 120 }) }],
  }));

  const resizeHandleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(resizeHandleActive.value ? 0.82 : 1, { duration: 120 }),
    transform: [{ scale: withTiming(resizeHandleActive.value ? 0.94 : 1, { duration: 120 }) }],
  }));

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .runOnJS(true)
        .onBegin(() => {
          dragHandleActive.value = 1;
          dragStartX.value = clampedModalSettings.x;
          dragStartY.value = clampedModalSettings.y;
        })
        .onUpdate((event) => {
          setModalSettings({
            x: dragStartX.value + event.translationX,
            y: dragStartY.value + event.translationY,
          });
        })
        .onFinalize(() => {
          dragHandleActive.value = 0;
        }),
    [
      clampedModalSettings.x,
      clampedModalSettings.y,
      dragHandleActive,
      dragStartX,
      dragStartY,
      setModalSettings,
    ]
  );

  const resizeGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .runOnJS(true)
        .onBegin(() => {
          resizeHandleActive.value = 1;
          resizeStartWidth.value = clampedModalSettings.width;
          resizeStartHeight.value = clampedModalSettings.height;
        })
        .onUpdate((event) => {
          setModalSettings({
            width: resizeStartWidth.value + event.translationX,
            height: resizeStartHeight.value + event.translationY,
          });
        })
        .onFinalize(() => {
          resizeHandleActive.value = 0;
        }),
    [
      clampedModalSettings.height,
      clampedModalSettings.width,
      resizeHandleActive,
      resizeStartHeight,
      resizeStartWidth,
      setModalSettings,
    ]
  );

  return (
    <ThemedView style={[styles.screen, { backgroundColor: pageBackground }]}> 
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.heroCard, { backgroundColor: panelColor, borderColor: panelBorder }]}> 
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <ThemedText style={[styles.chapterEyebrow, { color: chromeText }]}>Chapter {chapterIndex + 1}</ThemedText>
              <ThemedText style={[styles.chapterTitle, { color: textColor }]}>{chapter.title}</ThemedText>
              <ThemedText style={[styles.bookTitle, { color: chromeText }]}>{book.title}</ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowChrome((current) => !current)}
              style={[styles.chromeToggle, { borderColor: panelBorder }]}> 
              <Text style={[styles.chromeToggleText, { color: chromeText }]}>
                {showChrome ? 'Focus' : 'UI'}
              </Text>
            </Pressable>
          </View>

          {showChrome ? (
            <>
              <View style={styles.progressGroup}>
                <View style={styles.progressHeader}>
                  <ThemedText style={[styles.progressLabel, { color: chromeText }]}>Book</ThemedText>
                  <ThemedText style={[styles.progressValue, { color: textColor }]}>{readingProgress}%</ThemedText>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: progressTrack }]}> 
                  <View style={[styles.progressFill, { backgroundColor: progressFill, width: `${readingProgress}%` }]} />
                </View>
              </View>

              <View style={styles.progressGroup}>
                <View style={styles.progressHeader}>
                  <ThemedText style={[styles.progressLabel, { color: chromeText }]}>Chapter</ThemedText>
                  <ThemedText style={[styles.progressValue, { color: textColor }]}>{paragraphProgress}%</ThemedText>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: progressTrack }]}> 
                  <View style={[styles.progressFill, { backgroundColor: progressFill, width: `${paragraphProgress}%` }]} />
                </View>
              </View>

              <View style={styles.chapterNavRow}>
                <Pressable
                  disabled={!canGoPreviousChapter}
                  onPress={goToPreviousChapter}
                  style={[
                    styles.chapterNavButton,
                    { borderColor: panelBorder, opacity: canGoPreviousChapter ? 1 : 0.4 },
                  ]}>
                  <Text style={[styles.chapterNavText, { color: textColor }]}>Prev</Text>
                </Pressable>
                <Pressable
                  disabled={!canGoNextChapter}
                  onPress={goToNextChapter}
                  style={[
                    styles.chapterNavButton,
                    { borderColor: panelBorder, opacity: canGoNextChapter ? 1 : 0.4 },
                  ]}>
                  <Text style={[styles.chapterNavText, { color: textColor }]}>Next</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.readingPanel}>
          {paragraphUnits.map(({ paragraph, units }, index) => (
            <Pressable
              key={`${chapter.id}-${index}`}
              onPress={() => selectParagraph(index)}
              style={styles.paragraphBlock}>
              <View style={styles.paragraphRow}>
                {units.map((unit) => {
                  const token = unit.token;
                  const isHighlighted = getTokenHighlightState({
                    paragraphIndex: index,
                    selectedParagraphIndex,
                    selection,
                    token,
                  });
                  const rubyColor = unit.rubySource === 'dictionary' ? rubyDictionaryColor : rubyBookColor;

                  return (
                    <Pressable
                      key={`${index}-${token.start}-${token.end}-${token.surface}`}
                      onPress={() => handleTokenPress(index, paragraph, token)}
                      style={[
                        styles.inlineUnit,
                        isHighlighted.sentence && { backgroundColor: sentenceHighlightColor },
                        isHighlighted.token && { backgroundColor: tokenHighlightColor },
                      ]}>
                      {unit.rubyText ? (
                        <View style={styles.rubyUnit}>
                          <Text style={[styles.rubyText, { color: rubyColor }]}>{unit.rubyText}</Text>
                          <Text style={[styles.baseText, { color: textColor }]}>{token.surface}</Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.baseText,
                            {
                              color: textColor,
                              opacity: index === selectedParagraphIndex ? 1 : 0.92,
                            },
                          ]}>
                          {token.surface}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {showChrome ? (
        <View pointerEvents="box-none" style={styles.fabStack}>
          <Pressable
            onPress={() => setIsLookupVisible((current) => !current)}
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: fabBackground,
                width: TOOL_BUTTON_SIZE,
                height: TOOL_BUTTON_SIZE,
                opacity: pressed ? 0.86 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}>
            <Text style={[styles.fabText, { color: fabForeground }]}>辞</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal animationType="fade" transparent visible={isLookupVisible} onRequestClose={() => setIsLookupVisible(false)}>
        <GestureHandlerRootView style={styles.modalRoot}>
          <View pointerEvents="box-none" style={styles.modalRoot}>
            <Pressable
              style={[styles.modalBackdrop, { backgroundColor: overlayColor }]}
              onPress={() => setIsLookupVisible(false)}
            />
            <Animated.View
              style={[
                styles.lookupModal,
                modalAnimatedStyle,
                {
                  backgroundColor: modalCardColor,
                  borderColor: panelBorder,
                },
              ]}>
              <View style={[styles.modalHeader, { borderBottomColor: panelBorder }]}>
                <View style={styles.modalHeaderCopy}>
                  <ThemedText style={[styles.modalTitle, { color: modalTextColor }]}>
                    {selection?.type === 'token' ? selection.token.surface : 'Sentence'}
                  </ThemedText>
                  <ThemedText style={[styles.modalMeta, { color: chromeText }]}>
                    {selection?.type === 'token' ? buildTokenMeta(selection.token) : 'Double tap to select a sentence'}
                  </ThemedText>
                </View>
                <View style={styles.modalActions}>
                  <GestureDetector gesture={dragGesture}>
                    <Animated.View
                      style={[
                        styles.modalHandle,
                        dragHandleAnimatedStyle,
                        { backgroundColor: panelColor, borderColor: panelBorder },
                      ]}>
                      <View style={[styles.modalHandleBar, { backgroundColor: chromeText }]} />
                      <View style={[styles.modalHandleBar, { backgroundColor: chromeText }]} />
                    </Animated.View>
                  </GestureDetector>
                  <Pressable
                    onPress={() => setIsLookupVisible(false)}
                    style={({ pressed }) => [
                      styles.closeButton,
                      {
                        borderColor: panelBorder,
                        opacity: pressed ? 0.82 : 1,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}>
                    <Text style={[styles.closeButtonText, { color: chromeText }]}>×</Text>
                  </Pressable>
                </View>
              </View>
              <ScrollView contentContainerStyle={styles.modalBody}>
                {selection?.type === 'sentence' ? (
                  <ThemedText style={[styles.sentenceText, { color: modalTextColor }]}>{selection.text}</ThemedText>
                ) : dictionaryEntries.length > 0 ? (
                  <>
                    <View style={styles.rubyLegend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: rubyBookColor }]} />
                        <ThemedText style={[styles.legendText, { color: chromeText }]}>EPUB ruby</ThemedText>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: rubyDictionaryColor }]} />
                        <ThemedText style={[styles.legendText, { color: chromeText }]}>Dictionary ruby</ThemedText>
                      </View>
                    </View>
                    {dictionaryEntries.map((entry) => (
                      <View key={`${entry.key}-${entry.definition.slice(0, 40)}`} style={styles.entryBlock}>
                        <ThemedText style={[styles.entryKey, { color: modalTextColor }]}>
                          {entry.key}
                          {entry.reading ? ` · ${entry.reading}` : ''}
                        </ThemedText>
                        <Text selectable style={[styles.entryDefinition, { color: modalTextColor }]}>
                          {stripDefinitionHtml(entry.definition)}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <ThemedText style={[styles.emptyStateText, { color: chromeText }]}>No local dictionary entry for this token yet.</ThemedText>
                )}
              </ScrollView>

              <GestureDetector gesture={resizeGesture}>
                <Animated.View
                  style={[
                    styles.resizeHandle,
                    resizeHandleAnimatedStyle,
                    { backgroundColor: panelColor, borderColor: panelBorder },
                  ]}>
                  <View style={[styles.resizeGrip, { borderColor: chromeText }]} />
                  <View style={[styles.resizeGripSecondary, { borderColor: chromeText }]} />
                </Animated.View>
              </GestureDetector>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </ThemedView>
  );

  function handleTokenPress(paragraphIndex: number, paragraph: ReaderParagraph, token: ReaderToken) {
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
    setSelection({ type: 'token', token });
    setIsLookupVisible(true);
  }
}

function buildParagraphUnits(
  paragraph: ReaderParagraph,
  chapterTokens: ReaderToken[][],
  paragraphIndex: number,
  chapterRubyMap: Map<string, string>
): ParagraphUnit[] {
  const tokens = tokenizeReaderParagraph(paragraph, chapterTokens, paragraphIndex);
  const units: ParagraphUnit[] = [];

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];

    if (token.wordType === 'RUBY' && token.reading) {
      units.push({
        token,
        rubyText: token.reading,
        rubySource: 'book',
      });
      continue;
    }

    const mergedUnit = findMergedParagraphUnit(tokens, tokenIndex, chapterRubyMap);
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
            rubySource: 'dictionary',
          }
        : {
            token,
          }
    );
  }

  return units;
}

function buildChapterRubyMap(paragraphs: ReaderParagraph[]) {
  const rubyMap = new Map<string, string>();

  for (const paragraph of paragraphs) {
    for (const segment of paragraph.segments) {
      if (segment.type !== 'ruby') {
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
  chapterRubyMap: Map<string, string>
) {
  const maxGroupLength = Math.min(4, tokens.length - startIndex);

  for (let groupLength = maxGroupLength; groupLength >= 2; groupLength -= 1) {
    const group = tokens.slice(startIndex, startIndex + groupLength);
    if (!canMergeTokenGroup(group)) {
      continue;
    }

    const surface = group.map((token) => token.surface).join('');
    const bookRuby = chapterRubyMap.get(surface);
    if (bookRuby) {
      return {
        length: groupLength,
        unit: {
          token: buildMergedToken(group, surface, bookRuby),
          rubyText: bookRuby,
          rubySource: 'book' as const,
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
          rubySource: 'dictionary' as const,
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
      token.wordType === 'RUBY' ||
      token.pos === '記号' ||
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

function buildMergedToken(tokens: ReaderToken[], surface: string, reading: string): ReaderToken {
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
    wordType: 'MERGED',
  };
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

function isSameTokenSelection(selection: ReaderSelection | null, token: ReaderToken) {
  return (
    selection?.type === 'token' &&
    selection.token.start === token.start &&
    selection.token.end === token.end &&
    selection.token.pos === token.pos &&
    selection.token.surface === token.surface
  );
}

function isTokenInsideSentenceSelection(selection: ReaderSelection | null, token: ReaderToken) {
  return (
    selection?.type === 'sentence' &&
    token.start >= selection.start &&
    token.end <= selection.end
  );
}

function buildTokenMeta(token: ReaderToken) {
  const parts = [token.basicForm, token.reading ? toHiragana(token.reading) : undefined, token.pos].filter(Boolean);
  return parts.join(' · ');
}

function stripDefinitionHtml(definition: string) {
  return definition
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildSentenceSelection(paragraph: string, token: ReaderToken): ReaderSelection {
  const sentenceRange = findSentenceRange(paragraph, token.start, token.end);

  return {
    type: 'sentence',
    text: paragraph.slice(sentenceRange.start, sentenceRange.end).trim(),
    start: sentenceRange.start,
    end: sentenceRange.end,
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
  viewportHeight: number
) {
  const width = Math.min(Math.max(settings.width, 240), Math.max(240, viewportWidth - 24));
  const height = Math.min(Math.max(settings.height, 180), Math.max(180, viewportHeight - 80));

  return {
    width,
    height,
    x: Math.min(Math.max(settings.x, 12), Math.max(12, viewportWidth - width - 12)),
    y: Math.min(Math.max(settings.y, 72), Math.max(72, viewportHeight - height - 12)),
  };
}

function toHiragana(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 96,
    gap: 18,
    userSelect: 'none',
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    textTransform: 'uppercase',
  },
  chapterTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 28,
    lineHeight: 34,
  },
  bookTitle: {
    fontFamily: Fonts.serif,
    fontSize: 14,
    lineHeight: 20,
  },
  chromeToggle: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chromeToggleText: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 16,
  },
  progressGroup: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 18,
  },
  progressValue: {
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 18,
  },
  progressTrack: {
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  chapterNavRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chapterNavButton: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  chapterNavText: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  readingPanel: {
    gap: 26,
    userSelect: 'none',
  },
  paragraphBlock: {
    borderRadius: 12,
  },
  paragraphRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    rowGap: 12,
  },
  inlineUnit: {
    borderRadius: 8,
    justifyContent: 'flex-end',
    paddingHorizontal: 1,
    userSelect: 'none',
  },
  rubyUnit: {
    alignItems: 'center',
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
  fabStack: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    alignItems: 'center',
  },
  fab: {
    alignItems: 'center',
    boxShadow: '0px 10px 18px rgba(0, 0, 0, 0.14)',
    borderRadius: 999,
    justifyContent: 'center',
  },
  fabText: {
    fontFamily: Fonts.rounded,
    fontSize: 24,
    lineHeight: 26,
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  lookupModal: {
    position: 'absolute',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontSize: 22,
    lineHeight: 28,
  },
  modalMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  modalHandle: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 42,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modalHandleBar: {
    borderRadius: 999,
    height: 3,
    width: 18,
    opacity: 0.65,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  closeButtonText: {
    fontSize: 18,
    lineHeight: 20,
  },
  modalBody: {
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 42,
    paddingTop: 14,
  },
  rubyLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
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
  resizeHandle: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  resizeGrip: {
    height: 12,
    width: 12,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  resizeGripSecondary: {
    position: 'absolute',
    right: 9,
    bottom: 9,
    height: 8,
    width: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
});
