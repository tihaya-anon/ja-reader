import type { ReaderParagraph, ReaderToken } from '@/data/book-data';

export function tokenizeReaderParagraph(
  paragraph: ReaderParagraph,
  chapterTokens: ReaderToken[][],
  paragraphIndex: number
): ReaderToken[] {
  const sourceTokens = chapterTokens[paragraphIndex] ?? [];
  const displayTokens: ReaderToken[] = [];
  let tokenIndex = 0;
  let segmentOffset = 0;

  for (const segment of paragraph.segments) {
    if (segment.type === 'text') {
      while (
        tokenIndex < sourceTokens.length &&
        sourceTokens[tokenIndex].start < segmentOffset + segment.text.length
      ) {
        displayTokens.push(sourceTokens[tokenIndex]);
        tokenIndex += 1;
      }
      segmentOffset += segment.text.length;
      continue;
    }

    const segmentEnd = segmentOffset + segment.base.length;
    const coveredTokens: ReaderToken[] = [];

    while (tokenIndex < sourceTokens.length && sourceTokens[tokenIndex].start < segmentEnd) {
      coveredTokens.push(sourceTokens[tokenIndex]);
      tokenIndex += 1;
    }

    displayTokens.push(buildRubyDisplayToken(segment, coveredTokens, segmentOffset, segmentEnd));
    segmentOffset = segmentEnd;
  }

  return displayTokens;
}

function buildRubyDisplayToken(
  segment: Extract<ReaderParagraph['segments'][number], { type: 'ruby' }>,
  coveredTokens: ReaderToken[],
  start: number,
  end: number
): ReaderToken {
  const firstToken = coveredTokens[0];

  return {
    surface: segment.base,
    start: firstToken?.start ?? start,
    end: coveredTokens.at(-1)?.end ?? end,
    basicForm:
      coveredTokens.length === 1 ? coveredTokens[0].basicForm ?? segment.base : segment.base,
    reading: segment.reading,
    pronunciation:
      coveredTokens.length === 1 ? coveredTokens[0].pronunciation ?? segment.reading : segment.reading,
    pos: firstToken?.pos ?? '名詞',
    posDetail1: firstToken?.posDetail1,
    posDetail2: firstToken?.posDetail2,
    posDetail3: firstToken?.posDetail3,
    conjugatedType: coveredTokens.length === 1 ? firstToken?.conjugatedType : undefined,
    conjugatedForm: coveredTokens.length === 1 ? firstToken?.conjugatedForm : undefined,
    wordType: 'RUBY',
  };
}
