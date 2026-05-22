import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { TokenChip } from '@/components/reader/token-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { describeToken, type ReaderToken } from '@/features/reader/tokenize';
import { useReaderState } from '@/features/reader/use-reader-state';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ReaderScreen() {
  const {
    book,
    chapter,
    chapterIndex,
    paragraphProgress,
    readingProgress,
    selectedParagraph,
    selectedParagraphIndex,
    selectedTokens,
    canGoNextChapter,
    canGoPreviousChapter,
    goToNextChapter,
    goToPreviousChapter,
    selectParagraph,
  } = useReaderState();
  const [selectedToken, setSelectedToken] = useState<ReaderToken | null>(
    selectedTokens[0] ?? null
  );

  const cardBackgroundColor = useThemeColor(
    { light: '#F7EFD8', dark: '#1E221C' },
    'background'
  );
  const mutedColor = useThemeColor({ light: '#6B6257', dark: '#A39B8C' }, 'icon');
  const accentBackgroundColor = useThemeColor(
    { light: '#1F2A1F', dark: '#EFE3C3' },
    'text'
  );
  const accentTextColor = useThemeColor(
    { light: '#FFF6E0', dark: '#1A1A16' },
    'background'
  );
  const borderColor = useThemeColor({ light: '#D9CDB6', dark: '#363A32' }, 'icon');
  const selectedParagraphTextColor = useThemeColor(
    { light: '#16130F', dark: '#F9F4E8' },
    'text'
  );

  useEffect(() => {
    if (selectedTokens.length === 0) {
      setSelectedToken(null);
      return;
    }

    const hasSelectedToken = selectedTokens.some(
      (token) => token.value === selectedToken?.value && token.kind === selectedToken?.kind
    );

    if (!hasSelectedToken) {
      setSelectedToken(selectedTokens[0]);
    }
  }, [selectedToken, selectedTokens]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView
          style={[
            styles.heroCard,
            {
              backgroundColor: cardBackgroundColor,
              borderColor,
            },
          ]}>
          <ThemedText style={styles.eyebrow}>Japanese Reader MVP</ThemedText>
          <ThemedText type="title" style={styles.bookTitle}>
            {book.title}
          </ThemedText>
          <ThemedText style={styles.bookMeta}>
            {book.author} · {book.chapterCount} chapters · {book.sourceFile}
          </ThemedText>

          <View style={styles.progressRow}>
            <MetricPill label="Book" value={`${readingProgress}%`} />
            <MetricPill label="Chapter" value={`${chapterIndex + 1}/${book.chapterCount}`} />
            <MetricPill label="Paragraph" value={`${paragraphProgress}%`} />
          </View>
        </ThemedView>

        <ThemedView
          style={[
            styles.chapterHeader,
            {
              borderColor,
            },
          ]}>
          <View style={styles.chapterTitleWrap}>
            <ThemedText type="subtitle" style={styles.chapterTitle}>
              {chapter.title}
            </ThemedText>
            <ThemedText style={{ color: mutedColor }}>
              Phase 1: EPUB load, chapter reading, in-memory progress
            </ThemedText>
          </View>
          <View style={styles.chapterActions}>
            <ReaderButton
              disabled={!canGoPreviousChapter}
              label="Previous"
              onPress={goToPreviousChapter}
            />
            <ReaderButton disabled={!canGoNextChapter} label="Next" onPress={goToNextChapter} />
          </View>
        </ThemedView>

        <ThemedView style={styles.readingPanel}>
          {chapter.paragraphs.map((paragraph, index) => {
            const isSelected = index === selectedParagraphIndex;

            return (
              <Pressable
                key={`${chapter.id}-${index}`}
                onPress={() => selectParagraph(index)}
                style={[
                  styles.paragraphCard,
                  {
                    borderColor,
                    backgroundColor: isSelected ? cardBackgroundColor : 'transparent',
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.paragraphText,
                    isSelected && {
                      color: selectedParagraphTextColor,
                    },
                  ]}>
                  {paragraph}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <ThemedView
          style={[
            styles.analysisCard,
            {
              backgroundColor: cardBackgroundColor,
              borderColor,
            },
          ]}>
          <ThemedText type="subtitle" style={styles.analysisTitle}>
            Phase 2: Token inspection
          </ThemedText>
          <ThemedText style={[styles.analysisHint, { color: mutedColor }]}>
            Tap a paragraph above to re-tokenize it, then tap a token below to inspect the current
            chunk. This is a lightweight heuristic tokenizer, not a full morphological analyzer yet.
          </ThemedText>

          <ThemedView style={styles.selectedParagraphPreview}>
            <ThemedText style={styles.previewLabel}>Current paragraph</ThemedText>
            <ThemedText style={styles.previewText}>{selectedParagraph}</ThemedText>
          </ThemedView>

          <View style={styles.tokenWrap}>
            {selectedTokens.map((token, index) => {
              const isSelected =
                selectedToken?.value === token.value && selectedToken?.kind === token.kind;

              return (
                <TokenChip
                  key={`${token.value}-${token.kind}-${index}`}
                  isSelected={isSelected}
                  onPress={() => setSelectedToken(token)}
                  token={token}
                />
              );
            })}
          </View>

          <View
            style={[
              styles.tokenDetailCard,
              {
                backgroundColor: accentBackgroundColor,
              },
            ]}>
            <ThemedText style={[styles.tokenDetailEyebrow, { color: accentTextColor }]}>
              Current token
            </ThemedText>
            <ThemedText style={[styles.tokenDetailValue, { color: accentTextColor }]}>
              {selectedToken?.value ?? 'No token selected'}
            </ThemedText>
            <ThemedText style={[styles.tokenDetailMeta, { color: accentTextColor }]}>
              {selectedToken ? describeToken(selectedToken) : 'Select a token to inspect it.'}
            </ThemedText>
          </View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

function ReaderButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const buttonColor = useThemeColor({ light: '#1B241B', dark: '#F2E7C8' }, 'text');
  const textColor = useThemeColor({ light: '#FFF7E6', dark: '#171712' }, 'background');

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? '#8B877D' : buttonColor,
        },
      ]}>
      <ThemedText style={[styles.buttonLabel, { color: textColor }]}>{label}</ThemedText>
    </Pressable>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  const borderColor = useThemeColor({ light: '#C7B896', dark: '#42453B' }, 'icon');

  return (
    <View
      style={[
        styles.metricPill,
        {
          borderColor,
        },
      ]}>
      <ThemedText style={styles.metricLabel}>{label}</ThemedText>
      <ThemedText style={styles.metricValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 44,
    gap: 18,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bookTitle: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 40,
  },
  bookMeta: {
    fontSize: 15,
    lineHeight: 22,
  },
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 96,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 14,
    opacity: 0.74,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  chapterHeader: {
    borderBottomWidth: 1,
    gap: 14,
    paddingBottom: 16,
  },
  chapterTitleWrap: {
    gap: 6,
  },
  chapterTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
  },
  chapterActions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    borderRadius: 999,
    minWidth: 108,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  readingPanel: {
    gap: 12,
  },
  paragraphCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  paragraphText: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 32,
  },
  analysisCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  analysisTitle: {
    fontFamily: Fonts.rounded,
  },
  analysisHint: {
    fontSize: 14,
    lineHeight: 21,
  },
  selectedParagraphPreview: {
    gap: 8,
  },
  previewLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  previewText: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 30,
  },
  tokenWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tokenDetailCard: {
    borderRadius: 24,
    padding: 18,
    gap: 6,
  },
  tokenDetailEyebrow: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tokenDetailValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  tokenDetailMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
});
