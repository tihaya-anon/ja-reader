import type { ReaderToken } from '@/data/book-data';

export function buildLookupKeys(token: ReaderToken) {
  const keys = new Set<string>();

  if (token.basicForm) {
    keys.add(token.basicForm);
  }
  keys.add(token.surface);
  if (token.reading) {
    keys.add(token.reading);
  }

  return Array.from(keys);
}

export function getPrimaryLookupKey(token: ReaderToken) {
  return buildLookupKeys(token)[0] ?? token.surface;
}
