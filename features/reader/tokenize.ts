export type TokenKind =
  | 'kanji'
  | 'hiragana'
  | 'katakana'
  | 'latin'
  | 'number'
  | 'punctuation';

export type ReaderToken = {
  value: string;
  kind: TokenKind;
};

export function tokenizeJapanese(text: string): ReaderToken[] {
  const tokens: ReaderToken[] = [];
  let currentValue = '';
  let currentKind: TokenKind | null = null;

  for (const character of text) {
    if (/\s/u.test(character)) {
      flushCurrentToken();
      continue;
    }

    const nextKind = classifyCharacter(character);

    if (currentKind === nextKind) {
      currentValue += character;
      continue;
    }

    flushCurrentToken();
    currentValue = character;
    currentKind = nextKind;
  }

  flushCurrentToken();
  return tokens;

  function flushCurrentToken() {
    if (!currentValue || !currentKind) {
      currentValue = '';
      currentKind = null;
      return;
    }

    tokens.push({ value: currentValue, kind: currentKind });
    currentValue = '';
    currentKind = null;
  }
}

function classifyCharacter(character: string): TokenKind {
  if (/[一-龯々]/u.test(character)) {
    return 'kanji';
  }
  if (/[ぁ-ゖゝゞー]/u.test(character)) {
    return 'hiragana';
  }
  if (/[ァ-ヺヽヾ]/u.test(character)) {
    return 'katakana';
  }
  if (/[A-Za-z]/u.test(character)) {
    return 'latin';
  }
  if (/[0-9]/u.test(character)) {
    return 'number';
  }
  return 'punctuation';
}

export function describeToken(token: ReaderToken) {
  switch (token.kind) {
    case 'kanji':
      return 'Kanji cluster';
    case 'hiragana':
      return 'Hiragana cluster';
    case 'katakana':
      return 'Katakana cluster';
    case 'latin':
      return 'Latin letters';
    case 'number':
      return 'Numeric token';
    case 'punctuation':
      return 'Punctuation';
  }
}
