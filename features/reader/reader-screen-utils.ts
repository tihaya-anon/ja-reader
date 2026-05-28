import type { ReaderParagraph } from "@/data/book-data";
import type { ReaderSelectionSnapshot } from "@/features/reader/reader-annotations-context";
import {
  getDictionaryEntriesForToken,
  getRubyTextForSurface,
  resolveDictionaryRuby,
} from "@/features/reader/lookup";
import { tokenizeReaderParagraph } from "@/features/reader/paragraph";
import type { ReaderToken } from "@/features/reader/tokenize";

import type {
  NoteAnnotatedRange,
  ParagraphUnit,
  ReaderSelection,
} from "@/features/reader/reader-screen-types";

export function buildParagraphUnits(
  paragraph: ReaderParagraph,
  chapterTokens: ReaderToken[][],
  paragraphIndex: number,
  chapterRubyMap: Map<string, string>,
): ParagraphUnit[] {
  const tokens = tokenizeReaderParagraph(
    paragraph,
    chapterTokens,
    paragraphIndex,
  );
  const units: ParagraphUnit[] = [];

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];

    if (token.wordType === "RUBY" && token.reading) {
      units.push({
        token,
        rubyText: token.reading,
        rubySource: "book",
        needsSideSpacing: shouldAddRubySpacing(token.surface, token.reading),
      });
      continue;
    }

    const mergedUnit = findMergedParagraphUnit(
      tokens,
      tokenIndex,
      chapterRubyMap,
    );
    if (mergedUnit) {
      units.push(mergedUnit.unit);
      tokenIndex += mergedUnit.length - 1;
      continue;
    }

    const entries = getDictionaryEntriesForToken(token);
    const ruby = resolveDictionaryRuby(token, entries);

    units.push(
      ruby
        ? {
            token,
            rubyText: ruby,
            rubySource: "dictionary",
            needsSideSpacing: shouldAddRubySpacing(token.surface, ruby),
          }
        : { token },
    );
  }

  return units;
}

export function buildChapterRubyMap(paragraphs: ReaderParagraph[]) {
  const rubyMap = new Map<string, string>();

  for (const paragraph of paragraphs) {
    for (const segment of paragraph.segments) {
      if (segment.type !== "ruby") {
        continue;
      }

      if (!rubyMap.has(segment.base)) {
        rubyMap.set(segment.base, segment.reading);
      }
    }
  }

  return rubyMap;
}

function findMergedParagraphUnit(
  tokens: ReaderToken[],
  startIndex: number,
  chapterRubyMap: Map<string, string>,
) {
  const maxGroupLength = Math.min(4, tokens.length - startIndex);

  for (let groupLength = maxGroupLength; groupLength >= 2; groupLength -= 1) {
    const group = tokens.slice(startIndex, startIndex + groupLength);
    if (!canMergeTokenGroup(group)) {
      continue;
    }

    const surface = group.map((token) => token.surface).join("");
    const bookRuby = chapterRubyMap.get(surface);
    if (bookRuby) {
      return {
        length: groupLength,
        unit: {
          token: buildMergedToken(group, surface, bookRuby),
          rubyText: bookRuby,
          rubySource: "book" as const,
          needsSideSpacing: shouldAddRubySpacing(surface, bookRuby),
        },
      };
    }

    const dictionaryRuby = getRubyTextForSurface(surface);
    if (dictionaryRuby) {
      return {
        length: groupLength,
        unit: {
          token: buildMergedToken(group, surface, dictionaryRuby),
          rubyText: dictionaryRuby,
          rubySource: "dictionary" as const,
          needsSideSpacing: shouldAddRubySpacing(surface, dictionaryRuby),
        },
      };
    }
  }

  return null;
}

function canMergeTokenGroup(tokens: ReaderToken[]) {
  if (tokens.length < 2) {
    return false;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (
      token.wordType === "RUBY" ||
      token.pos === "記号" ||
      !token.surface.trim()
    ) {
      return false;
    }

    const nextToken = tokens[index + 1];
    if (nextToken && token.end !== nextToken.start) {
      return false;
    }
  }

  return true;
}

function buildMergedToken(
  tokens: ReaderToken[],
  surface: string,
  reading: string,
): ReaderToken {
  const firstToken = tokens[0];
  const lastToken = tokens.at(-1) ?? firstToken;

  return {
    surface,
    start: firstToken.start,
    end: lastToken.end,
    basicForm: surface,
    reading,
    pronunciation: reading,
    pos: firstToken.pos,
    posDetail1: firstToken.posDetail1,
    posDetail2: firstToken.posDetail2,
    posDetail3: firstToken.posDetail3,
    wordType: "MERGED",
  };
}

function shouldAddRubySpacing(surface: string, rubyText: string) {
  const trimmedSurface = surface.trim();
  const trimmedRuby = rubyText.trim();

  if (!trimmedSurface || !trimmedRuby) {
    return false;
  }

  return estimateRubyWidth(trimmedRuby) > estimateBaseWidth(trimmedSurface);
}

function estimateRubyWidth(text: string) {
  let width = 0;

  for (const char of text) {
    width += isNarrowKana(char) ? 0.55 : 1;
  }

  return width;
}

function estimateBaseWidth(text: string) {
  let width = 0;

  for (const char of text) {
    width += isWideJapaneseGlyph(char) ? 1 : 0.7;
  }

  return width;
}

function isNarrowKana(char: string) {
  return "ゃゅょぁぃぅぇぉっャュョァィゥェォッヮゎ".includes(char);
}

function isWideJapaneseGlyph(char: string) {
  return /[一-龯々ぁ-ゖァ-ヺー]/u.test(char);
}

export function getTokenHighlightState({
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

export function isSameTokenSelection(
  selection: ReaderSelection | null,
  token: ReaderToken,
) {
  return (
    selection?.type === "token" &&
    selection.token.start === token.start &&
    selection.token.end === token.end &&
    selection.token.pos === token.pos &&
    selection.token.surface === token.surface
  );
}

export function isTokenInsideSentenceSelection(
  selection: ReaderSelection | null,
  token: ReaderToken,
) {
  return (
    selection?.type === "sentence" &&
    token.start >= selection.start &&
    token.end <= selection.end
  );
}

export function buildTokenMeta(token: ReaderToken) {
  const parts = [
    token.basicForm,
    token.reading ? toHiragana(token.reading) : undefined,
    token.pos,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function stripDefinitionHtml(definition: string) {
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

export function buildSentenceSelection(
  paragraph: string,
  token: ReaderToken,
): ReaderSelection {
  const sentenceRange = findSentenceRange(paragraph, token.start, token.end);

  return {
    type: "sentence",
    text: paragraph.slice(sentenceRange.start, sentenceRange.end).trim(),
    start: sentenceRange.start,
    end: sentenceRange.end,
  };
}

export function toSelectionSnapshot(
  selection: ReaderSelection,
): ReaderSelectionSnapshot {
  if (selection.type === "sentence") {
    return selection;
  }

  return {
    type: "token",
    text: selection.token.surface,
    start: selection.token.start,
    end: selection.token.end,
    pos: selection.token.pos,
    basicForm: selection.token.basicForm,
    reading: selection.token.reading
      ? toHiragana(selection.token.reading)
      : undefined,
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

export function clampModalSettings(
  settings: { x: number; y: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
) {
  "worklet";

  const width = Math.min(
    Math.max(settings.width, 240),
    Math.max(240, viewportWidth - 24),
  );
  const height = Math.min(
    Math.max(settings.height, 180),
    Math.max(180, viewportHeight - 80),
  );

  return {
    width,
    height,
    x: Math.min(
      Math.max(settings.x, 12),
      Math.max(12, viewportWidth - width - 12),
    ),
    y: Math.min(
      Math.max(settings.y, 72),
      Math.max(72, viewportHeight - height - 12),
    ),
  };
}

export function summarizeExcerpt(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 80 ? `${compact.slice(0, 80)}…` : compact;
}

export function getTokenNoteMarkers(
  token: ReaderToken,
  ranges: NoteAnnotatedRange[],
) {
  const tokenRange = ranges.find(
    (range) =>
      range.type === "token" &&
      token.start === range.start &&
      token.end === range.end,
  );

  const sentenceRange = ranges.find(
    (range) =>
      range.type === "sentence" &&
      token.start >= range.start &&
      token.end <= range.end,
  );

  if (!tokenRange && !sentenceRange) {
    return null;
  }

  return {
    hasTokenNote: Boolean(tokenRange),
    hasSentenceNote: Boolean(sentenceRange),
    isSentenceStart: sentenceRange
      ? token.start === sentenceRange.start
      : false,
    isSentenceEnd: sentenceRange ? token.end === sentenceRange.end : false,
  };
}

function toHiragana(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.replace(/[ァ-ヶ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}
