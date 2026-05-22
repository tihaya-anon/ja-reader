import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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

const DOUBLE_TAP_DELAY_MS = 240;

export default function ReaderScreen() {
  const { chapter, selectedParagraph, selectedParagraphIndex, selectedTokens, selectParagraph } =
    useReaderState();
  const [selection, setSelection] = useState<ReaderSelection | null>(
    selectedTokens[0] ? { type: 'token', token: selectedTokens[0] } : null
  );
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ paragraphIndex: number; tokenStart: number; time: number } | null>(
    null
  );

  const paragraphTokens = useMemo(
    () => chapter.paragraphs.map((paragraph) => tokenizeReaderParagraph(paragraph)),
    [chapter.paragraphs]
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
            token.kind === currentSelection.token.kind &&
            token.value === currentSelection.token.value
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
    pendingTapRef.current = setTimeout(() => {
      setSelection({ type: 'token', token });
      pendingTapRef.current = null;
    }, DOUBLE_TAP_DELAY_MS);
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.readingPanel}>
          {chapter.paragraphs.map((paragraph, index) => {
            const tokens = paragraphTokens[index] ?? [];

            return (
              <Text
                key={`${chapter.id}-${index}`}
                style={[
                  styles.paragraphText,
                  {
                    color: textColor,
                    opacity: index === selectedParagraphIndex ? 1 : 0.92,
                  },
                ]}>
                {renderParagraphSegments({
                  paragraph,
                  paragraphIndex: index,
                  rubyColor,
                  selection,
                  selectedParagraphIndex,
                  sentenceHighlightColor,
                  tokenHighlightColor,
                  tokens,
                  onTokenPress: handleTokenPress,
                })}
              </Text>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function renderParagraphSegments({
  paragraph,
  paragraphIndex,
  rubyColor,
  selection,
  selectedParagraphIndex,
  sentenceHighlightColor,
  tokenHighlightColor,
  tokens,
  onTokenPress,
}: {
  paragraph: ReaderParagraph;
  paragraphIndex: number;
  rubyColor: string;
  selection: ReaderSelection | null;
  selectedParagraphIndex: number;
  sentenceHighlightColor: string;
  tokenHighlightColor: string;
  tokens: ReaderToken[];
  onTokenPress: (paragraphIndex: number, paragraph: ReaderParagraph, token: ReaderToken) => void;
}) {
  let segmentOffset = 0;
  let tokenIndex = 0;

  return paragraph.segments.map((segment, segmentIndex) => {
    if (segment.type === 'text') {
      const segmentTokens: ReaderToken[] = [];
      while (tokenIndex < tokens.length && tokens[tokenIndex].start < segmentOffset + segment.text.length) {
        segmentTokens.push(tokens[tokenIndex]);
        tokenIndex += 1;
      }
      segmentOffset += segment.text.length;

      return (
        <Fragment key={`${paragraphIndex}-text-${segmentIndex}`}>
          {segmentTokens.map((token) => renderSelectableToken({
            paragraph,
            paragraphIndex,
            selectedParagraphIndex,
            selection,
            sentenceHighlightColor,
            tokenHighlightColor,
            token,
            onTokenPress,
          }))}
        </Fragment>
      );
    }

    const rubyToken = tokens[tokenIndex];
    tokenIndex += 1;
    segmentOffset += segment.base.length;

    return (
      <Text
        key={`${paragraphIndex}-ruby-${segmentIndex}`}
        onPress={() => onTokenPress(paragraphIndex, paragraph, rubyToken)}
        style={getTokenHighlightStyle({
          paragraphIndex,
          selectedParagraphIndex,
          selection,
          sentenceHighlightColor,
          tokenHighlightColor,
          token: rubyToken,
        })}>
        <Text style={styles.rubyWrap}>
          <Text style={[styles.rubyText, { color: rubyColor }]}>{segment.reading}</Text>
          <Text style={styles.rubyBase}>{segment.base}</Text>
        </Text>
      </Text>
    );
  });
}

function renderSelectableToken({
  paragraph,
  paragraphIndex,
  selectedParagraphIndex,
  selection,
  sentenceHighlightColor,
  tokenHighlightColor,
  token,
  onTokenPress,
}: {
  paragraph: ReaderParagraph;
  paragraphIndex: number;
  selectedParagraphIndex: number;
  selection: ReaderSelection | null;
  sentenceHighlightColor: string;
  tokenHighlightColor: string;
  token: ReaderToken;
  onTokenPress: (paragraphIndex: number, paragraph: ReaderParagraph, token: ReaderToken) => void;
}) {
  return (
    <Text
      key={`${paragraphIndex}-${token.start}-${token.end}-${token.value}`}
      onPress={() => onTokenPress(paragraphIndex, paragraph, token)}
      style={getTokenHighlightStyle({
        paragraphIndex,
        selectedParagraphIndex,
        selection,
        sentenceHighlightColor,
        tokenHighlightColor,
        token,
      })}>
      {token.value}
    </Text>
  );
}

function getTokenHighlightStyle({
  paragraphIndex,
  selectedParagraphIndex,
  selection,
  sentenceHighlightColor,
  tokenHighlightColor,
  token,
}: {
  paragraphIndex: number;
  selectedParagraphIndex: number;
  selection: ReaderSelection | null;
  sentenceHighlightColor: string;
  tokenHighlightColor: string;
  token: ReaderToken;
}) {
  const isTokenSelected =
    paragraphIndex === selectedParagraphIndex &&
    selection?.type === 'token' &&
    selection.token.start === token.start &&
    selection.token.end === token.end &&
    selection.token.kind === token.kind &&
    selection.token.value === token.value;
  const isSentenceSelected =
    paragraphIndex === selectedParagraphIndex &&
    selection?.type === 'sentence' &&
    token.start >= selection.start &&
    token.end <= selection.end;

  return [
    styles.inlineToken,
    isSentenceSelected && {
      backgroundColor: sentenceHighlightColor,
    },
    isTokenSelected && {
      backgroundColor: tokenHighlightColor,
    },
  ];
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
  },
  readingPanel: {
    gap: 34,
  },
  paragraphText: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 42,
    letterSpacing: 0.2,
  },
  inlineToken: {
    borderRadius: 6,
  },
  rubyWrap: {
    alignItems: 'center',
    display: 'inline-flex',
    flexDirection: 'column',
    verticalAlign: 'top',
  },
  rubyText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    lineHeight: 12,
  },
  rubyBase: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 28,
  },
});
