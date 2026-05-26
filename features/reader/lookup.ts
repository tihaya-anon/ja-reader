import { readerDictionaryData, type ReaderDictionaryEntry } from '@/data/dictionary-data';
import type { ReaderToken } from '@/data/book-data';

const SPECIAL_SURFACE_READINGS: Record<string, string> = {
  一人: 'ひとり',
  二人: 'ふたり',
};

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

export function getDictionaryEntriesForToken(token: ReaderToken | null) {
  if (!token) {
    return [];
  }

  const entries: ReaderDictionaryEntry[] = [];
  const seen = new Set<string>();

  for (const key of buildLookupKeys(token)) {
    const matches = readerDictionaryData.entriesByKey[key] ?? [];

    for (const entry of matches) {
      const signature = `${entry.key}\n${entry.definition}`;
      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      entries.push(entry);
    }
  }

  return entries.slice(0, 3);
}

export function getRubyTextForSurface(surface: string) {
  if (!hasKanji(surface)) {
    return null;
  }

  const specialReading = SPECIAL_SURFACE_READINGS[surface];
  if (specialReading) {
    return specialReading;
  }

  const entries = readerDictionaryData.entriesByKey[surface] ?? [];

  for (const entry of entries) {
    const reading = getEntryReading(entry);
    if (reading) {
      return reading;
    }
  }

  return null;
}

export function resolveDictionaryRuby(token: ReaderToken, entries: ReaderDictionaryEntry[]) {
  if (!hasKanji(token.surface)) {
    return null;
  }

  const specialReading = SPECIAL_SURFACE_READINGS[token.surface];
  if (specialReading) {
    return specialReading;
  }

  const normalizedSurface = normalizeJapaneseText(token.surface);
  const normalizedBasicForm = normalizeJapaneseText(token.basicForm);

  for (const entry of entries) {
    const reading = getEntryReading(entry);
    if (!reading) {
      continue;
    }

    const normalizedKey = normalizeJapaneseText(entry.key);
    if (
      normalizedKey === normalizedSurface ||
      (normalizedBasicForm && normalizedKey === normalizedBasicForm)
    ) {
      return reading;
    }
  }

  return null;
}

function getEntryReading(entry: ReaderDictionaryEntry) {
  if (entry.reading) {
    return normalizeRubyReading(entry.reading);
  }

  const extracted = extractReadingFromDefinition(entry.definition);
  return extracted ? normalizeRubyReading(extracted) : null;
}

function hasKanji(value: string) {
  return /[\p{Script=Han}]/u.test(value);
}

function normalizeJapaneseText(value?: string) {
  return value?.replace(/[\s・･]/g, '');
}

function toHiragana(value: string) {
  return value.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function normalizeRubyReading(value: string) {
  return toHiragana(value)
    .replace(/[・･\s]/g, '')
    .replace(/[‐‑‒–—―ー－]/g, '');
}

function extractReadingFromDefinition(definition: string) {
  const boldMatches = definition.matchAll(/<b>(.*?)<\/b>/gis);

  for (const match of boldMatches) {
    const candidate = stripHtml(match[1] ?? '').trim();
    if (looksLikeReading(candidate)) {
      return candidate;
    }
  }

  return null;
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function looksLikeReading(value: string) {
  const normalized = value.replace(/[・･\s]/g, '').replace(/[‐‑‒–—―ー－]/g, '');
  return /[ぁ-ゖァ-ヺ]/u.test(normalized) && /^[ぁ-ゖァ-ヺ]+$/u.test(normalized);
}
