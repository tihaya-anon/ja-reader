import type { ReaderInlineSegment, ReaderParagraph } from '@/data/book-data';
import { tokenizeJapanese, type ReaderToken, type TokenKind } from '@/features/reader/tokenize';

export function tokenizeReaderParagraph(paragraph: ReaderParagraph): ReaderToken[] {
  const tokens: ReaderToken[] = [];
  let offset = 0;

  for (const segment of paragraph.segments) {
    if (segment.type === 'text') {
      for (const token of tokenizeJapanese(segment.text)) {
        tokens.push({
          ...token,
          start: token.start + offset,
          end: token.end + offset,
        });
      }
      offset += segment.text.length;
      continue;
    }

    tokens.push(buildRubyToken(segment, offset));
    offset += segment.base.length;
  }

  return tokens;
}

function buildRubyToken(segment: Extract<ReaderInlineSegment, { type: 'ruby' }>, offset: number) {
  const baseTokens = tokenizeJapanese(segment.base);
  const kind: TokenKind = baseTokens[0]?.kind ?? 'kanji';

  return {
    value: segment.base,
    kind,
    start: offset,
    end: offset + segment.base.length,
    reading: segment.reading,
  } satisfies ReaderToken;
}
