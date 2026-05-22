export type ReaderToken = {
  surface: string;
  start: number;
  end: number;
  basicForm?: string;
  reading?: string;
  pronunciation?: string;
  pos: string;
  posDetail1?: string;
  posDetail2?: string;
  posDetail3?: string;
  conjugatedType?: string;
  conjugatedForm?: string;
  wordType?: string;
};

export function describeToken(token: ReaderToken) {
  if (token.basicForm && token.basicForm !== token.surface) {
    return `Base: ${token.basicForm}`;
  }

  if (token.reading) {
    return `Reading: ${token.reading}`;
  }

  return token.pos;
}
