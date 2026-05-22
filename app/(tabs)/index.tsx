import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ReaderParagraph } from '@/data/book-data';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
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

const DOUBLE_TAP_DELAY_MS = 240;

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
  const lastTapRef = useRef<{ paragraphIndex: number; tokenStart: number; time: number } | null>(
    null
  );

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

  useEffect(() => {
    return () => {
      if (pendingTapRef.current) {
        clearTimeout(pendingTapRef.current);
      }
    };
  }, []);

  function handleTokenPress(paragraphIndex: number, paragraph: ReaderParagraph, token: ReaderToken) {
    const now = Date.now();
    const lastTap = lastTapRef.current;
    const isDoubleTap =
      lastTap &&
      lastTap.paragraphIndex === paragraphIndex &&
      lastTap.tokenStart === token.start &&
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

    lastTapRef.current = {
      paragraphIndex,
      tokenStart: token.start,
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
    selection?.type === 'token' &&
    selection.token.start === token.start &&
    selection.token.end === token.end &&
    selection.token.pos === token.pos &&
    selection.token.surface === token.surface;
  const sentenceSelected =
    paragraphIndex === selectedParagraphIndex &&
    selection?.type === 'sentence' &&
    token.start >= selection.start &&
    token.end <= selection.end;

  return {
    token: tokenSelected,
    sentence: sentenceSelected,
  };
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
