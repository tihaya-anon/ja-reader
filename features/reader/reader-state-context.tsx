import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { readerBook, type ReaderToken } from '@/data/book-data';
import { chapterTokenFiles } from '@/data/book-token-files';
import { tokenizeReaderParagraph } from '@/features/reader/paragraph';

type ReaderStateValue = {
  book: typeof readerBook;
  chapter: (typeof readerBook.chapters)[number];
  chapterIndex: number;
  chapterTokens: ReaderToken[][];
  paragraphProgress: number;
  readingProgress: number;
  selectedParagraph: (typeof readerBook.chapters)[number]['paragraphs'][number];
  selectedParagraphIndex: number;
  selectedTokens: ReaderToken[];
  canGoNextChapter: boolean;
  canGoPreviousChapter: boolean;
  goToChapter: (nextChapterIndex: number) => void;
  goToNextChapter: () => void;
  goToPreviousChapter: () => void;
  selectParagraph: (nextParagraphIndex: number) => void;
};

const ReaderStateContext = createContext<ReaderStateValue | null>(null);

export function ReaderStateProvider({ children }: PropsWithChildren) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState(0);

  const chapter = readerBook.chapters[chapterIndex];
  const chapterTokens = chapterTokenFiles[chapter.tokenFile] ?? [];
  const selectedParagraph =
    chapter.paragraphs[selectedParagraphIndex] ?? chapter.paragraphs[0] ?? { text: '', segments: [] };
  const selectedTokens = useMemo(
    () => tokenizeReaderParagraph(selectedParagraph, chapterTokens, selectedParagraphIndex),
    [chapterTokens, selectedParagraph, selectedParagraphIndex]
  );

  const readingProgress = Math.round(((chapterIndex + 1) / readerBook.chapterCount) * 100);
  const paragraphProgress = chapter.paragraphs.length
    ? Math.round(((selectedParagraphIndex + 1) / chapter.paragraphs.length) * 100)
    : 0;

  function goToChapter(nextChapterIndex: number) {
    const safeChapterIndex = clamp(nextChapterIndex, 0, readerBook.chapterCount - 1);
    setChapterIndex(safeChapterIndex);
    setSelectedParagraphIndex(0);
  }

  function goToNextChapter() {
    goToChapter(chapterIndex + 1);
  }

  function goToPreviousChapter() {
    goToChapter(chapterIndex - 1);
  }

  function selectParagraph(nextParagraphIndex: number) {
    const safeParagraphIndex = clamp(nextParagraphIndex, 0, chapter.paragraphs.length - 1);
    setSelectedParagraphIndex(safeParagraphIndex);
  }

  const value = useMemo(
    () => ({
      book: readerBook,
      chapter,
      chapterIndex,
      chapterTokens,
      paragraphProgress,
      readingProgress,
      selectedParagraph,
      selectedParagraphIndex,
      selectedTokens,
      canGoNextChapter: chapterIndex < readerBook.chapterCount - 1,
      canGoPreviousChapter: chapterIndex > 0,
      goToChapter,
      goToNextChapter,
      goToPreviousChapter,
      selectParagraph,
    }),
    [
      chapter,
      chapterIndex,
      chapterTokens,
      paragraphProgress,
      readingProgress,
      selectedParagraph,
      selectedParagraphIndex,
      selectedTokens,
    ]
  );

  return <ReaderStateContext.Provider value={value}>{children}</ReaderStateContext.Provider>;
}

export function useReaderState() {
  const context = useContext(ReaderStateContext);

  if (!context) {
    throw new Error('useReaderState must be used within ReaderStateProvider');
  }

  return context;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
