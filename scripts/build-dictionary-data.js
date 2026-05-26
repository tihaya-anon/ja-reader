const fs = require('node:fs');
const path = require('node:path');
const { MDX } = require('js-mdict');

const projectRoot = path.resolve(__dirname, '..');
const dataDirectory = path.join(projectRoot, 'data');
const tokensDirectory = path.join(dataDirectory, 'book-tokens');
const dictDirectory = path.join(dataDirectory, 'dict');
const outputPath = path.join(dataDirectory, 'dictionary-data.ts');

const MAX_LOOKUP_RESULTS = 3;
const MAX_DEFINITION_LENGTH = 1400;

function main() {
  const dictPath = findFirstFile(dictDirectory, '.mdx');

  if (!dictPath) {
    writeEmptyDictionaryData();
    console.log(`No MDX dictionary found in ${dictDirectory}; wrote empty dictionary data`);
    return;
  }

  const tokens = loadBookTokens(tokensDirectory);
  const lookupKeys = collectLookupKeys(tokens);
  const dict = new MDX(dictPath);
  const entriesByKey = {};
  let matchedKeyCount = 0;

  for (const key of lookupKeys) {
    const entries = lookupEntries(dict, key);
    if (entries.length === 0) {
      continue;
    }

    entriesByKey[key] = entries;
    matchedKeyCount += 1;
  }

  writeDictionaryData({
    dictionaryName: path.basename(dictPath, '.mdx'),
    sourceFile: path.basename(dictPath),
    entriesByKey,
  });

  console.log(
    `Wrote ${path.relative(projectRoot, outputPath)} with ${matchedKeyCount}/${lookupKeys.size} matched lookup keys from ${path.basename(dictPath)}`
  );
}

function findFirstFile(directoryPath, extension) {
  if (!fs.existsSync(directoryPath)) {
    return null;
  }

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const fileEntry = entries.find((entry) => entry.isFile() && entry.name.endsWith(extension));
  return fileEntry ? path.join(directoryPath, fileEntry.name) : null;
}

function loadBookTokens(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(directoryPath, name), 'utf8')))
    .flat();
}

function collectLookupKeys(tokens) {
  const keys = new Set();

  for (const token of tokens) {
    addLookupKey(keys, token.surface);
    addLookupKey(keys, token.basicForm);
  }

  return keys;
}

function addLookupKey(keys, value) {
  if (!value) {
    return;
  }

  const normalized = value.trim();
  if (!normalized || /^[\p{P}\p{S}\d]+$/u.test(normalized)) {
    return;
  }

  keys.add(normalized);
}

function lookupEntries(dict, key) {
  const exactEntries = dedupeEntries(resolveLookup(dict, key));
  if (exactEntries.length > 0) {
    return exactEntries.slice(0, MAX_LOOKUP_RESULTS);
  }

  const prefixEntries = dedupeEntries(resolvePrefix(dict, key)).filter((entry) => isStrongPrefixMatch(entry, key));
  return prefixEntries.slice(0, MAX_LOOKUP_RESULTS);
}

function resolveLookup(dict, key) {
  const result = safeLookup(dict, key);
  if (!result) {
    return [];
  }

  return [normalizeEntry(dict, result)].filter(Boolean);
}

function resolvePrefix(dict, key) {
  const results = safePrefix(dict, key);

  return results
    .map((result) => normalizeEntry(dict, result))
    .filter(Boolean);
}

function safeLookup(dict, key) {
  try {
    return dict.lookup(key);
  } catch {
    return null;
  }
}

function safePrefix(dict, key) {
  try {
    return dict.prefix(key) ?? [];
  } catch {
    return [];
  }
}

function normalizeEntry(dict, result) {
  if (!result?.keyText) {
    return null;
  }

  const resolved = resolveLinkedDefinition(dict, result);
  if (!resolved?.definition) {
    return null;
  }

  const key = String(resolved.keyText).trim();
  const definition = sanitizeDefinitionHtml(String(resolved.definition));
  if (!definition) {
    return null;
  }

  return {
    key,
    reading: extractReading(key, definition),
    definition,
  };
}

function extractReading(key, definition) {
  const keyReading = key.match(/[（(]([\p{Script=Hiragana}\p{Script=Katakana}ー・]+)[)）]/u);
  if (keyReading) {
    return keyReading[1];
  }

  const headword = definition.match(
    /<b>\s*([\p{Script=Hiragana}\p{Script=Katakana}ー・]+)\s*<\/b>/u
  );
  if (headword) {
    return headword[1];
  }

  const inline = definition.match(
    /【[^】]+】(?:<[^>]+>|\s)*([\p{Script=Hiragana}\p{Script=Katakana}ー・]+)(?:\s|<|\[)/u
  );
  if (inline) {
    return inline[1];
  }

  return undefined;
}

function resolveLinkedDefinition(dict, result) {
  const linkTarget = extractLinkTarget(result.definition);

  if (!linkTarget) {
    return result;
  }

  const linked = safeLookup(dict, linkTarget);
  return linked ?? result;
}

function extractLinkTarget(definition) {
  if (!definition) {
    return null;
  }

  const match = String(definition).match(/^@@@LINK=(.+)$/m);
  return match ? match[1].replace(/\u0000/g, '').trim() : null;
}

function sanitizeDefinitionHtml(html) {
  return html
    .replace(/\u0000/g, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DEFINITION_LENGTH);
}

function isStrongPrefixMatch(entry, key) {
  if (!entry?.key) {
    return false;
  }

  return entry.key.startsWith(key) || entry.definition.includes(`【${key}】`);
}

function dedupeEntries(entries) {
  const seen = new Set();
  const deduped = [];

  for (const entry of entries) {
    if (!entry) {
      continue;
    }

    const signature = `${entry.key}\n${entry.definition}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    deduped.push(entry);
  }

  return deduped;
}

function writeDictionaryData(payload) {
  const fileContents = [
    'export type ReaderDictionaryEntry = {',
    '  key: string;',
    '  reading?: string;',
    '  definition: string;',
    '};',
    '',
    'export type ReaderDictionaryData = {',
    '  dictionaryName: string;',
    '  sourceFile: string;',
    '  entriesByKey: Record<string, ReaderDictionaryEntry[]>;',
    '};',
    '',
    `export const readerDictionaryData: ReaderDictionaryData = ${JSON.stringify(payload, null, 2)};`,
    '',
  ].join('\n');

  fs.writeFileSync(outputPath, fileContents, 'utf8');
}

function writeEmptyDictionaryData() {
  writeDictionaryData({
    dictionaryName: '',
    sourceFile: '',
    entriesByKey: {},
  });
}

main();
