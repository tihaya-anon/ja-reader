import type { ReaderSelectionSnapshot } from "@/features/reader/reader-annotations-context";
import type { ReaderToken } from "@/features/reader/tokenize";

export type ReaderSelection =
  | {
      type: "token";
      token: ReaderToken;
    }
  | {
      type: "sentence";
      text: string;
      start: number;
      end: number;
    };

export type RubySource = "book" | "dictionary";

export type ParagraphUnit = {
  token: ReaderToken;
  rubyText?: string;
  rubySource?: RubySource;
  needsSideSpacing?: boolean;
};

export type NoteAnnotatedRange = {
  type: ReaderSelectionSnapshot["type"];
  start: number;
  end: number;
};

export type TokenNoteMarkers = {
  hasTokenNote: boolean;
  hasSentenceNote: boolean;
  isSentenceStart: boolean;
  isSentenceEnd: boolean;
} | null;
