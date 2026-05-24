import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ReaderParagraph } from '@/data/book-data';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { readerDictionaryData } from '@/data/dictionary-data';
import { buildLookupKeys } from '@/features/reader/lookup';
import { tokenizeReaderParagraph } from '@/features/reader/paragraph';
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

type ParagraphUnit =
  | {
      type: 'token';
      token: ReaderToken;
    }
  | {
      type: 'ruby';
      token: ReaderToken;
      reading: string;
    };

const DOUBLE_TAP_DELAY_MS = 380;

export default function ReaderScreen() {
  const {
    chapter,
    chapterTokens,
    selectedParagraph,
    selectedParagraphIndex,
    selectedTokens,
    selectParagraph,
  } = useReaderState();
  const [selection, setSelection] = useState<ReaderSelection | null>(
    selectedTokens[0] ? { type: 'token', token: selectedTokens[0] } : null
  );
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<
    { paragraphIndex: number; tokenStart: number; tokenEnd: number; time: number } | null
  >(null);

  const paragraphUnits = useMemo(
    () =>
      chapter.paragraphs.map((paragraph, paragraphIndex) => ({
        paragraph,
        tokens: tokenizeReaderParagraph(paragraph, chapterTokens, paragraphIndex),
        units: buildParagraphUnits(paragraph, chapterTokens, paragraphIndex),
      })),
    [chapter.paragraphs, chapterTokens]
  );

  const textColor = useThemeColor({ light: '#16130F', dark: '#F9F4E8' }, 'text');
  const rubyColor = useThemeColor({ light: '#7C6B4A', dark: '#CDBB96' }, 'icon');
  const tokenHighlightColor = useThemeColor(
    { light: '#CDB48A', dark: '#5E533E' },
    'background'
  );
  const sentenceHighlightColor = useThemeColor(
    { light: '#E9DEC1', dark: '#32372D' },
    'background'
  );
  const detailCardColor = useThemeColor(
    { light: '#F3E9D5', dark: '#20251D' },
    'background'
  );
  const detailBorderColor = useThemeColor({ light: '#D6C39E', dark: '#46513F' }, 'icon');
  const mutedTextColor = useThemeColor({ light: '#6E6045', dark: '#A99A7B' }, 'icon');
  const sentenceTextColor = useThemeColor({ light: '#3A3225', dark: '#E7DFC9' }, 'text');

  const selectedToken = selection?.type === 'token' ? selection.token : null;
  const dictionaryEntries = useMemo(
    () => getDictionaryEntriesForToken(selectedToken),
    [selectedToken]
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
      return;
    }

    setSelection((currentSelection) => {
      if (!currentSelection) {
        return { type: 'token', token: selectedTokens[0] };
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
          : { type: 'token', token: selectedTokens[0] };
      }

      return currentSelection.end <= selectedParagraph.text.length
        ? currentSelection
        : { type: 'token', token: selectedTokens[0] };
    });
  }, [selectedParagraph, selectedTokens]);

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
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.readingPanel}>
          {paragraphUnits.map(({ paragraph, units }, index) => (
            <View key={`${chapter.id}-${index}`} style={styles.paragraphRow}>
              {units.map((unit) => {
                const token = unit.token;
                const isHighlighted = getTokenHighlightState({
                  paragraphIndex: index,
                  selectedParagraphIndex,
                  selection,
                  token,
                });

                return (
                  <Pressable
                    key={`${index}-${token.start}-${token.end}-${token.surface}`}
                    onPress={() => handleTokenPress(index, paragraph, token)}
                    style={[
                      styles.inlineUnit,
                      isHighlighted.sentence && {
                        backgroundColor: sentenceHighlightColor,
                      },
                      isHighlighted.token && {
                        backgroundColor: tokenHighlightColor,
                      },
                    ]}>
                    {unit.type === 'ruby' ? (
                      <View style={styles.rubyUnit}>
                        <Text style={[styles.rubyText, { color: rubyColor }]}>{unit.reading}</Text>
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
          ))}
        </View>

        {selection ? (
          <ThemedView
            style={[
              styles.detailCard,
              {
                backgroundColor: detailCardColor,
                borderColor: detailBorderColor,
              },
            ]}>
            {selection.type === 'sentence' ? (
              <View style={styles.detailSection}>
                <ThemedText type="defaultSemiBold" style={styles.detailTitle}>
                  Sentence
                </ThemedText>
                <ThemedText style={[styles.sentenceText, { color: sentenceTextColor }]}>
                  {selection.text}
                </ThemedText>
              </View>
            ) : (
              <>
                <View style={styles.detailSection}>
                  <ThemedText type="defaultSemiBold" style={styles.detailTitle}>
                    {selection.token.surface}
                  </ThemedText>
                  <ThemedText style={[styles.tokenMeta, { color: mutedTextColor }]}>
                    {buildTokenMeta(selection.token)}
                  </ThemedText>
                </View>

                <View style={styles.detailSection}>
                  <ThemedText type="defaultSemiBold" style={styles.detailSubtitle}>
                    {readerDictionaryData.dictionaryName || 'Dictionary'}
                  </ThemedText>
                  {dictionaryEntries.length > 0 ? (
                    dictionaryEntries.map((entry) => (
                      <View key={`${entry.key}-${entry.definition.slice(0, 40)}`} style={styles.entryBlock}>
                        <ThemedText style={styles.entryKey}>{entry.key}</ThemedText>
                        <Text selectable style={[styles.entryDefinition, { color: sentenceTextColor }]}>
                          {stripDefinitionHtml(entry.definition)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <ThemedText style={[styles.emptyStateText, { color: mutedTextColor }]}>
                      No local dictionary entry for this token yet.
                    </ThemedText>
                  )}
                </View>
              </>
            )}
          </ThemedView>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function buildParagraphUnits(
  paragraph: ReaderParagraph,
  chapterTokens: ReaderToken[][],
  paragraphIndex: number
): ParagraphUnit[] {
  const tokens = tokenizeReaderParagraph(paragraph, chapterTokens, paragraphIndex);
  const units: ParagraphUnit[] = [];
  let tokenIndex = 0;
  let segmentOffset = 0;

  for (const segment of paragraph.segments) {
    if (segment.type === 'text') {
      const segmentEnd = segmentOffset + segment.text.length;

      while (tokenIndex < tokens.length && tokens[tokenIndex].start < segmentEnd) {
        units.push({ type: 'token', token: tokens[tokenIndex] });
        tokenIndex += 1;
      }
      segmentOffset = segmentEnd;
      continue;
    }

    const rubyToken = tokens[tokenIndex];
    if (rubyToken) {
      units.push({
        type: 'ruby',
        token: rubyToken,
        reading: segment.reading,
      });
      tokenIndex += 1;
    }
    segmentOffset += segment.base.length;
  }

  return units;
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

function getDictionaryEntriesForToken(token: ReaderToken | null) {
  if (!token) {
    return [];
  }

  const entries = [];
  const seen = new Set();

  for (const key of buildLookupKeys(token)) {
    const matches = readerDictionaryData.entriesByKey[key] ?? [];

    for (const entry of matches) {
      const signature = `${entry.key}\n${entry.definition}`;
      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      entries.push(entry);
    }
  }

  return entries.slice(0, 3);
}

function buildTokenMeta(token: ReaderToken) {
  const parts = [token.basicForm, token.reading, token.pos].filter(Boolean);
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 48,
    userSelect: 'none',
  },
  readingPanel: {
    gap: 34,
    userSelect: 'none',
  },
  detailCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    marginTop: 30,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  detailSection: {
    gap: 10,
  },
  detailTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
    lineHeight: 28,
  },
  detailSubtitle: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    lineHeight: 22,
  },
  tokenMeta: {
    fontSize: 14,
    lineHeight: 20,
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
  paragraphRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    rowGap: 10,
    columnGap: 0,
  },
  inlineUnit: {
    borderRadius: 6,
    justifyContent: 'flex-end',
    userSelect: 'none',
  },
  baseText: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 34,
    letterSpacing: 0.2,
  },
  rubyUnit: {
    minHeight: 52,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingTop: 16,
    position: 'relative',
  },
  rubyText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 13,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});
