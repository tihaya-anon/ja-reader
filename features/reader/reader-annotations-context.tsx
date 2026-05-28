import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import type { ReaderDictionaryEntry } from "@/data/dictionary-data";

export type ReaderSelectionSnapshot =
  | {
      type: "token";
      text: string;
      start: number;
      end: number;
      pos?: string;
      basicForm?: string;
      reading?: string;
    }
  | {
      type: "sentence";
      text: string;
      start: number;
      end: number;
    };

export type ReaderBookmark = {
  id: string;
  createdAt: string;
  chapterIndex: number;
  paragraphIndex: number;
  paragraphText: string;
  excerpt: string;
  noteCount: number;
};

export type ReaderNote = {
  id: string;
  createdAt: string;
  updatedAt: string;
  chapterIndex: number;
  paragraphIndex: number;
  paragraphText: string;
  title: string;
  body: string;
  selection: ReaderSelectionSnapshot;
  dictionarySnapshot: Array<{
    key: string;
    reading?: string;
    definition: string;
  }>;
  aiContext: {
    status: "idle" | "ready";
    promptSeed: string;
    tags: string[];
  };
};

type ReaderAnnotationsState = {
  bookmarks: ReaderBookmark[];
  notes: ReaderNote[];
};

type CreateBookmarkInput = {
  chapterIndex: number;
  paragraphIndex: number;
  paragraphText: string;
  excerpt: string;
};

type CreateNoteInput = {
  chapterIndex: number;
  chapterTitle: string;
  paragraphIndex: number;
  paragraphText: string;
  selection: ReaderSelectionSnapshot;
  body: string;
  title?: string;
  dictionaryEntries: ReaderDictionaryEntry[];
};

type ReaderAnnotationsContextValue = {
  bookmarks: ReaderBookmark[];
  notes: ReaderNote[];
  addBookmark: (input: CreateBookmarkInput) => void;
  removeBookmark: (bookmarkId: string) => void;
  isBookmarked: (chapterIndex: number, paragraphIndex: number) => boolean;
  getBookmark: (chapterIndex: number, paragraphIndex: number) => ReaderBookmark | undefined;
  addNote: (input: CreateNoteInput) => void;
  updateNote: (noteId: string, body: string) => void;
  removeNote: (noteId: string) => void;
  getNotesForParagraph: (chapterIndex: number, paragraphIndex: number) => ReaderNote[];
  getNotesForSelection: (selection: ReaderSelectionSnapshot | null) => ReaderNote[];
};

const STORAGE_KEY = "reader.annotations.v1";

const ReaderAnnotationsContext = createContext<ReaderAnnotationsContextValue | null>(null);

export function ReaderAnnotationsProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<ReaderAnnotationsState>({
    bookmarks: [],
    notes: [],
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw || !isMounted) {
          return;
        }

        const parsed = JSON.parse(raw) as Partial<ReaderAnnotationsState>;
        if (!parsed) {
          return;
        }

        setState({
          bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
          notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        });
      } catch {
        // Ignore invalid persisted state and fall back to defaults.
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // Ignore persistence failures in the MVP.
    });
  }, [isLoaded, state]);

  const value = useMemo<ReaderAnnotationsContextValue>(
    () => ({
      bookmarks: state.bookmarks,
      notes: state.notes,
      addBookmark: (input) => {
        setState((current) => {
          const existing = current.bookmarks.find(
            (bookmark) =>
              bookmark.chapterIndex === input.chapterIndex &&
              bookmark.paragraphIndex === input.paragraphIndex,
          );

          if (existing) {
            return current;
          }

          const bookmark: ReaderBookmark = {
            id: createId("bookmark"),
            createdAt: new Date().toISOString(),
            chapterIndex: input.chapterIndex,
            paragraphIndex: input.paragraphIndex,
            paragraphText: input.paragraphText,
            excerpt: input.excerpt,
            noteCount: current.notes.filter(
              (note) =>
                note.chapterIndex === input.chapterIndex &&
                note.paragraphIndex === input.paragraphIndex,
            ).length,
          };

          return {
            ...current,
            bookmarks: [bookmark, ...current.bookmarks],
          };
        });
      },
      removeBookmark: (bookmarkId) => {
        setState((current) => ({
          ...current,
          bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
        }));
      },
      isBookmarked: (chapterIndex, paragraphIndex) =>
        state.bookmarks.some(
          (bookmark) =>
            bookmark.chapterIndex === chapterIndex &&
            bookmark.paragraphIndex === paragraphIndex,
        ),
      getBookmark: (chapterIndex, paragraphIndex) =>
        state.bookmarks.find(
          (bookmark) =>
            bookmark.chapterIndex === chapterIndex &&
            bookmark.paragraphIndex === paragraphIndex,
        ),
      addNote: (input) => {
        setState((current) => {
          const now = new Date().toISOString();
          const title = input.title?.trim() || buildNoteTitle(input.selection);
          const existing = current.notes.find(
            (note) =>
              note.selection.type === input.selection.type &&
              note.selection.start === input.selection.start &&
              note.selection.end === input.selection.end &&
              note.selection.text === input.selection.text,
          );
          const note: ReaderNote = {
            id: existing?.id ?? createId("note"),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            chapterIndex: input.chapterIndex,
            paragraphIndex: input.paragraphIndex,
            paragraphText: input.paragraphText,
            title,
            body: input.body.trim(),
            selection: input.selection,
            dictionarySnapshot: input.dictionaryEntries.map((entry) => ({
              key: entry.key,
              reading: entry.reading,
              definition: entry.definition,
            })),
            aiContext: {
              status: "ready",
              promptSeed: buildAiPromptSeed(
                input.chapterTitle,
                input.paragraphText,
                input.selection,
                input.body,
              ),
              tags: buildAiTags(input.selection),
            },
          };

          const nextNotes = existing
            ? current.notes.map((entry) => (entry.id === existing.id ? note : entry))
            : [note, ...current.notes];

          const noteDelta = existing ? 0 : 1;
          const nextBookmarks = current.bookmarks.map((bookmark) => {
            if (
              bookmark.chapterIndex === input.chapterIndex &&
              bookmark.paragraphIndex === input.paragraphIndex
            ) {
              return { ...bookmark, noteCount: bookmark.noteCount + noteDelta };
            }

            return bookmark;
          });

          return {
            bookmarks: nextBookmarks,
            notes: nextNotes,
          };
        });
      },
      updateNote: (noteId, body) => {
        setState((current) => ({
          ...current,
          notes: current.notes.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  body: body.trim(),
                  updatedAt: new Date().toISOString(),
                  aiContext: {
                    ...note.aiContext,
                    promptSeed: buildAiPromptSeed(
                      `Chapter ${note.chapterIndex + 1}`,
                      note.paragraphText,
                      note.selection,
                      body,
                    ),
                  },
                }
              : note,
          ),
        }));
      },
      removeNote: (noteId) => {
        setState((current) => {
          const removed = current.notes.find((note) => note.id === noteId);
          if (!removed) {
            return current;
          }

          const nextNotes = current.notes.filter((note) => note.id !== noteId);
          const nextBookmarks = current.bookmarks.map((bookmark) =>
            bookmark.chapterIndex === removed.chapterIndex &&
            bookmark.paragraphIndex === removed.paragraphIndex
              ? {
                  ...bookmark,
                  noteCount: Math.max(bookmark.noteCount - 1, 0),
                }
              : bookmark,
          );

          return {
            bookmarks: nextBookmarks,
            notes: nextNotes,
          };
        });
      },
      getNotesForParagraph: (chapterIndex, paragraphIndex) =>
        state.notes.filter(
          (note) =>
            note.chapterIndex === chapterIndex && note.paragraphIndex === paragraphIndex,
        ),
      getNotesForSelection: (selection) => {
        if (!selection) {
          return [];
        }

        return state.notes.filter(
          (note) =>
            note.selection.type === selection.type &&
            note.selection.start === selection.start &&
            note.selection.end === selection.end &&
            note.selection.text === selection.text,
        );
      },
    }),
    [state.bookmarks, state.notes],
  );

  return (
    <ReaderAnnotationsContext.Provider value={value}>
      {children}
    </ReaderAnnotationsContext.Provider>
  );
}

export function useReaderAnnotations() {
  const context = useContext(ReaderAnnotationsContext);

  if (!context) {
    throw new Error("useReaderAnnotations must be used within ReaderAnnotationsProvider");
  }

  return context;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildNoteTitle(selection: ReaderSelectionSnapshot) {
  const text = selection.text.trim();
  return text.length > 24 ? `${text.slice(0, 24)}…` : text;
}

function buildAiPromptSeed(
  chapterTitle: string,
  paragraphText: string,
  selection: ReaderSelectionSnapshot,
  body: string,
) {
  return `Chapter: ${chapterTitle}\nParagraph: ${paragraphText}\nSelection: ${selection.text}\nReader note: ${body.trim()}`;
}

function buildAiTags(selection: ReaderSelectionSnapshot) {
  return selection.type === "token"
    ? ["reader", "dictionary-linked", "token-note"]
    : ["reader", "sentence-note"];
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
