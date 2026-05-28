import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { ReaderSelectionSnapshot } from "@/features/reader/reader-annotations-context";
import { useReaderAnnotations } from "@/features/reader/reader-annotations-context";
import {
  useReaderChrome,
  useSetReaderChromeNavigation,
} from "@/features/reader/reader-chrome-context";
import type { NoteAnnotatedRange, ReaderSelection } from "@/features/reader/reader-screen-types";
import {
  buildChapterRubyMap,
  buildParagraphUnits,
  buildSentenceSelection,
  clampModalSettings,
  summarizeExcerpt,
  toSelectionSnapshot,
} from "@/features/reader/reader-screen-utils";
import { useReaderState } from "@/features/reader/reader-state-context";
import type { ReaderToken } from "@/features/reader/tokenize";
import { useReaderSettings } from "@/features/reader/use-reader-settings";
import { getDictionaryEntriesForToken } from "@/features/reader/lookup";
import type { ReaderParagraph } from "@/data/book-data";

const DOUBLE_TAP_DELAY_MS = 380;

export function useReaderScreenController() {
  const readerState = useReaderState();
  const readerSettings = useReaderSettings();
  const readerChrome = useReaderChrome();
  const setChromeNavigation = useSetReaderChromeNavigation();
  const readerAnnotations = useReaderAnnotations();

  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [isLookupVisible, setIsLookupVisible] = useState(false);
  const [isNoteComposerVisible, setIsNoteComposerVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteSelectionSnapshot, setNoteSelectionSnapshot] =
    useState<ReaderSelectionSnapshot | null>(null);
  const [noteDictionarySnapshot, setNoteDictionarySnapshot] = useState(
    [] as ReturnType<typeof getDictionaryEntriesForToken>,
  );

  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{
    paragraphIndex: number;
    tokenStart: number;
    tokenEnd: number;
    time: number;
  } | null>(null);

  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const modalX = useSharedValue(readerSettings.modalSettings.x);
  const modalY = useSharedValue(readerSettings.modalSettings.y);
  const modalWidth = useSharedValue(readerSettings.modalSettings.width);
  const modalHeight = useSharedValue(readerSettings.modalSettings.height);
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
    () => readerAnnotations.getNotesForSelection(selectionSnapshot),
    [readerAnnotations, selectionSnapshot],
  );
  const activeSelectionNote = selectionNotes[0] ?? null;
  const currentParagraphText =
    readerState.chapter.paragraphs[readerState.selectedParagraphIndex]?.text ?? "";
  const currentBookmark = readerAnnotations.getBookmark(
    readerState.chapterIndex,
    readerState.selectedParagraphIndex,
  );
  const paragraphNotes = useMemo(
    () =>
      readerAnnotations.getNotesForParagraph(
        readerState.chapterIndex,
        readerState.selectedParagraphIndex,
      ),
    [
      readerAnnotations,
      readerState.chapterIndex,
      readerState.selectedParagraphIndex,
    ],
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
    () => clampModalSettings(readerSettings.modalSettings, viewportWidth, viewportHeight),
    [readerSettings.modalSettings, viewportHeight, viewportWidth],
  );
  const chapterRubyMap = useMemo(
    () => buildChapterRubyMap(readerState.chapter.paragraphs),
    [readerState.chapter.paragraphs],
  );
  const paragraphUnits = useMemo(
    () =>
      readerState.chapter.paragraphs.map((paragraph, paragraphIndex) => ({
        paragraph,
        units: buildParagraphUnits(
          paragraph,
          readerState.chapterTokens,
          paragraphIndex,
          chapterRubyMap,
        ),
      })),
    [chapterRubyMap, readerState.chapter.paragraphs, readerState.chapterTokens],
  );

  useEffect(() => {
    setChromeNavigation({
      canGoPreviousChapter: readerState.canGoPreviousChapter,
      canGoNextChapter: readerState.canGoNextChapter,
      goToPreviousChapter: readerState.goToPreviousChapter,
      goToNextChapter: readerState.goToNextChapter,
    });
  }, [
    readerState.canGoNextChapter,
    readerState.canGoPreviousChapter,
    readerState.goToNextChapter,
    readerState.goToPreviousChapter,
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
    if (readerState.selectedTokens.length === 0) {
      setSelection(null);
      setIsLookupVisible(false);
      return;
    }

    setSelection((currentSelection) => {
      if (!currentSelection) {
        return null;
      }

      if (currentSelection.type === "token") {
        const nextToken = readerState.selectedTokens.find(
          (token) =>
            token.start === currentSelection.token.start &&
            token.end === currentSelection.token.end &&
            token.pos === currentSelection.token.pos &&
            token.surface === currentSelection.token.surface,
        );

        return nextToken ? { type: "token", token: nextToken } : null;
      }

      return currentSelection.end <= readerState.selectedParagraph.text.length
        ? currentSelection
        : null;
    });
  }, [readerState.selectedParagraph, readerState.selectedTokens]);

  useEffect(() => {
    if (selection?.type === "token") {
      setIsLookupVisible(true);
    }
  }, [selection]);

  useEffect(() => {
    if (
      clampedModalSettings.x !== readerSettings.modalSettings.x ||
      clampedModalSettings.y !== readerSettings.modalSettings.y ||
      clampedModalSettings.width !== readerSettings.modalSettings.width ||
      clampedModalSettings.height !== readerSettings.modalSettings.height
    ) {
      readerSettings.setModalSettings(clampedModalSettings);
    }
  }, [clampedModalSettings, readerSettings]);

  useEffect(() => {
    modalX.value = clampedModalSettings.x;
    modalY.value = clampedModalSettings.y;
    modalWidth.value = clampedModalSettings.width;
    modalHeight.value = clampedModalSettings.height;
  }, [clampedModalSettings, modalHeight, modalWidth, modalX, modalY]);

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
        scale: withTiming(resizeHandleActive.value ? 0.94 : 1, { duration: 120 }),
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
          scheduleOnRN(readerSettings.setModalSettings, {
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
      readerSettings,
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
          scheduleOnRN(readerSettings.setModalSettings, {
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
      readerSettings,
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
      readerAnnotations.removeBookmark(currentBookmark.id);
      return;
    }

    readerAnnotations.addBookmark({
      chapterIndex: readerState.chapterIndex,
      paragraphIndex: readerState.selectedParagraphIndex,
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
      readerAnnotations.updateNote(editingNoteId, noteDraft);
      closeNoteComposer();
      return;
    }

    readerAnnotations.addNote({
      chapterIndex: readerState.chapterIndex,
      chapterTitle: readerState.chapter.title,
      paragraphIndex: readerState.selectedParagraphIndex,
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

    readerAnnotations.removeNote(editingNoteId);
    closeNoteComposer();
    setSelection(null);
  }

  function handleTokenPress(
    paragraphIndex: number,
    paragraph: ReaderParagraph,
    token: ReaderToken,
    isTokenSelected: boolean,
    isSentenceSelected: boolean,
  ) {
    const now = Date.now();
    const lastTap = lastTapRef.current;
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

    readerState.selectParagraph(paragraphIndex);

    if (isDoubleTap) {
      lastTapRef.current = null;
      setSelection(buildSentenceSelection(paragraph.text, token));
      setIsLookupVisible(true);
      return;
    }

    if (isTokenSelected || isSentenceSelected) {
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

  return {
    readerState,
    readerSettings,
    readerChrome,
    selection,
    isLookupVisible,
    selectedToken,
    dictionaryEntries,
    activeSelectionNote,
    noteDraft,
    setNoteDraft,
    editingNoteId,
    isNoteComposerVisible,
    noteSelectionSnapshot,
    noteDictionarySnapshot,
    currentBookmark,
    noteAnnotatedRanges,
    viewportHeight,
    paragraphUnits,
    modalAnimatedStyle,
    dragHandleAnimatedStyle,
    resizeHandleAnimatedStyle,
    dragGesture,
    resizeGesture,
    closeLookup,
    closeNoteComposer,
    toggleBookmark,
    openNoteComposer,
    openNoteEditor,
    saveNote,
    deleteEditingNote,
    handleTokenPress,
  };
}
