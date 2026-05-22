import { useMemo, useState } from 'react';

import { readerBook } from '@/data/book-data';
import { tokenizeJapanese } from '@/features/reader/tokenize';

export function useReaderState() {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState(0);

  const chapter = readerBook.chapters[chapterIndex];
  const selectedParagraph =
    chapter.paragraphs[selectedParagraphIndex] ?? chapter.paragraphs[0] ?? '';
  const selectedTokens = useMemo(
    () => tokenizeJapanese(selectedParagraph),
    [selectedParagraph]
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

  return {
    book: readerBook,
    chapter,
    chapterIndex,
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
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
