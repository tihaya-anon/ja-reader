import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { useReaderAnnotations } from '@/features/reader/reader-annotations-context';
import { useReaderState } from '@/features/reader/reader-state-context';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function LibraryScreen() {
  const router = useRouter();
  const {
    book,
    chapterIndex,
    readingProgress,
    paragraphProgress,
    goToChapter,
  } = useReaderState();
  const { bookmarks, notes } = useReaderAnnotations();
  const borderColor = useThemeColor({ light: '#D8CCB9', dark: '#363A32' }, 'icon');
  const cardBackgroundColor = useThemeColor(
    { light: '#F7F1E4', dark: '#1D211B' },
    'background'
  );

  const totalParagraphs = book.chapters.reduce(
    (count, chapter) => count + chapter.paragraphs.length,
    0
  );
  const totalTokens = book.chapters.reduce((count, chapter) => count + chapter.wordCount, 0);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Library
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          This tab is the current inventory view for the imported EPUB. Later phases can grow this
          into dictionary management, bookmarks, notes, and AI actions.
        </ThemedText>

        <ThemedView
          style={[
            styles.summaryCard,
            {
              backgroundColor: cardBackgroundColor,
              borderColor,
            },
          ]}>
          <SummaryRow label="Title" value={book.title} />
          <SummaryRow label="Author" value={book.author} />
          <SummaryRow label="Language" value={book.language} />
          <SummaryRow label="Chapters" value={`${book.chapterCount}`} />
          <SummaryRow label="Paragraphs" value={`${totalParagraphs}`} />
          <SummaryRow label="Token clusters" value={`${totalTokens}`} />
          <SummaryRow label="Reading" value={`${readingProgress}% · Chapter ${chapterIndex + 1}`} />
          <SummaryRow label="Current chapter" value={`${paragraphProgress}%`} />
          <SummaryRow label="Bookmarks" value={`${bookmarks.length}`} />
          <SummaryRow label="Notes" value={`${notes.length}`} />
        </ThemedView>

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Reader Memory
          </ThemedText>
          <ThemedText style={styles.sectionHint}>
            Bookmarks mark return points. Notes already preserve selection context, dictionary snapshots, and AI-ready metadata.
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.summaryCard,
            {
              backgroundColor: cardBackgroundColor,
              borderColor,
            },
          ]}>
          {bookmarks.length > 0 ? (
            bookmarks.slice(0, 3).map((bookmark) => (
              <View key={bookmark.id} style={styles.memoryBlock}>
                <ThemedText style={styles.memoryTitle}>
                  Bookmark · Chapter {bookmark.chapterIndex + 1}
                </ThemedText>
                <ThemedText style={styles.memoryBody}>{bookmark.excerpt}</ThemedText>
                <ThemedText style={styles.memoryMeta}>
                  Paragraph {bookmark.paragraphIndex + 1} · {bookmark.noteCount} linked notes
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText style={styles.memoryEmpty}>
              No bookmarks yet. Add one from the reader header or lookup panel.
            </ThemedText>
          )}

          {notes.length > 0 ? (
            notes.slice(0, 3).map((note) => (
              <View key={note.id} style={styles.memoryBlock}>
                <ThemedText style={styles.memoryTitle}>{note.title}</ThemedText>
                <ThemedText style={styles.memoryBody}>{note.body}</ThemedText>
                <ThemedText style={styles.memoryMeta}>
                  {note.selection.type} · {note.aiContext.tags.join(' · ')}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText style={styles.memoryEmpty}>
              No notes yet. Notes will capture the current selection and dictionary context.
            </ThemedText>
          )}
        </ThemedView>

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Chapters
          </ThemedText>
          <ThemedText style={styles.sectionHint}>
            Useful now for validation; later this becomes navigation, bookmarks, and search.
          </ThemedText>
        </View>

        {book.chapters.map((chapter, index) => (
          <Pressable
            key={chapter.id}
            onPress={() => {
              goToChapter(index);
              router.navigate('/(tabs)');
            }}
            style={[
              styles.chapterCard,
              {
                borderColor,
                backgroundColor:
                  index === chapterIndex
                    ? cardBackgroundColor
                    : index % 2 === 0
                      ? 'rgba(0, 0, 0, 0.02)'
                      : 'transparent',
              },
            ]}>
            <View style={styles.chapterRow}>
              <ThemedText style={styles.chapterNumber}>{String(index + 1).padStart(2, '0')}</ThemedText>
              <View style={styles.chapterBody}>
                <ThemedText style={styles.chapterTitle}>{chapter.title}</ThemedText>
                <ThemedText style={styles.chapterMeta}>
                  {chapter.paragraphs.length} paragraphs · {chapter.wordCount} token clusters
                  {index === chapterIndex ? ' · current' : ''}
                </ThemedText>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText style={styles.summaryLabel}>{label}</ThemedText>
      <ThemedText style={styles.summaryValue}>{value}</ThemedText>
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
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontFamily: Fonts.serif,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
  },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 14,
    opacity: 0.72,
  },
  summaryValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  sectionHeader: {
    gap: 6,
    marginTop: 6,
  },
  sectionTitle: {
    fontFamily: Fonts.rounded,
  },
  sectionHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  chapterCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chapterRow: {
    flexDirection: 'row',
    gap: 14,
  },
  chapterNumber: {
    fontSize: 14,
    lineHeight: 20,
    minWidth: 24,
    opacity: 0.7,
  },
  chapterBody: {
    flex: 1,
    gap: 4,
  },
  chapterTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 26,
  },
  chapterMeta: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.72,
  },
  memoryBlock: {
    gap: 4,
    paddingBottom: 4,
  },
  memoryTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 18,
  },
  memoryBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  memoryMeta: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.72,
  },
  memoryEmpty: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.72,
  },
});
