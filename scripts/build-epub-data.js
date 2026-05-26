const fs = require('node:fs');
const path = require('node:path');
const kuromoji = require('kuromoji');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const dataDirectory = path.join(projectRoot, 'data');
const outputPath = path.join(projectRoot, 'data', 'book-data.ts');
const tokenManifestPath = path.join(projectRoot, 'data', 'book-token-files.ts');
const tokensDirectory = path.join(projectRoot, 'data', 'book-tokens');
const dictionaryPath = path.join(path.dirname(require.resolve('kuromoji')), '../dict');
const preferredDevSampleName = 'dev-sample-ja.epub';

async function main() {
  const epubPath = findPreferredEpub(dataDirectory);

  if (!epubPath) {
    throw new Error(`No EPUB file found in ${dataDirectory}`);
  }

  fs.rmSync(tokensDirectory, { recursive: true, force: true });
  fs.mkdirSync(tokensDirectory, { recursive: true });

  const book = parseEpubWithPython(epubPath);
  const tokenizer = await buildTokenizer();
  const { lightweightBook, tokenFiles } = writeTokenFiles(book, tokenizer);
  writeBookData(lightweightBook);
  writeTokenManifest(tokenFiles);
  buildDictionaryData();
  console.log(`Wrote ${path.relative(projectRoot, outputPath)} and chapter token files from ${path.basename(epubPath)}`);
}

function findPreferredEpub(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const epubFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.epub'));
  const preferredEntry =
    epubFiles.find((entry) => entry.name === preferredDevSampleName) ??
    epubFiles.find((entry) => entry.name !== `${preferredDevSampleName}.placeholder`);
  const fileEntry = preferredEntry ?? null;
  return fileEntry ? path.join(directoryPath, fileEntry.name) : null;
}

function parseEpubWithPython(epubPath) {
  const scriptPath = path.join(projectRoot, 'scripts', 'parse_epub.py');
  const result = spawnSync('python3', [scriptPath, epubPath], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to parse EPUB');
  }

  return JSON.parse(result.stdout);
}

function buildDictionaryData() {
  const scriptPath = path.join(projectRoot, 'scripts', 'build-dictionary-data.js');
  const result = spawnSync('node', [scriptPath], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to build dictionary data');
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
}

function buildTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: dictionaryPath }).build((error, tokenizer) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(tokenizer);
    });
  });
}

function writeTokenFiles(book, tokenizer) {
  const tokenFiles = [];
  const lightweightBook = {
    ...book,
    chapters: book.chapters.map((chapter, chapterIndex) => {
      const tokenFile = `book-tokens/chapter-${String(chapterIndex + 1).padStart(3, '0')}.json`;
      const tokenPayload = chapter.paragraphs.map((paragraph) => tokenizeParagraph(tokenizer, paragraph.text));
      fs.writeFileSync(path.join(dataDirectory, tokenFile), JSON.stringify(tokenPayload), 'utf8');
      tokenFiles.push(tokenFile);

      return {
        ...chapter,
        tokenFile,
      };
    }),
  };

  return { lightweightBook, tokenFiles };
}

function tokenizeParagraph(tokenizer, text) {
  return tokenizer.tokenize(text).map((token) => {
    const start = token.word_position - 1;
    const end = start + token.surface_form.length;

    return {
      surface: token.surface_form,
      start,
      end,
      basicForm: normalizeTokenField(token.basic_form),
      reading: normalizeTokenField(token.reading),
      pronunciation: normalizeTokenField(token.pronunciation),
      pos: token.pos,
      posDetail1: normalizeTokenField(token.pos_detail_1),
      posDetail2: normalizeTokenField(token.pos_detail_2),
      posDetail3: normalizeTokenField(token.pos_detail_3),
      conjugatedType: normalizeTokenField(token.conjugated_type),
      conjugatedForm: normalizeTokenField(token.conjugated_form),
      wordType: normalizeTokenField(token.word_type),
    };
  });
}

function normalizeTokenField(value) {
  return value && value !== '*' ? value : undefined;
}

function writeBookData(lightweightBook) {
  const fileContents = [
    'export type ReaderToken = {',
    '  surface: string;',
    '  start: number;',
    '  end: number;',
    '  basicForm?: string;',
    '  reading?: string;',
    '  pronunciation?: string;',
    '  pos: string;',
    '  posDetail1?: string;',
    '  posDetail2?: string;',
    '  posDetail3?: string;',
    '  conjugatedType?: string;',
    '  conjugatedForm?: string;',
    '  wordType?: string;',
    '};',
    '',
    'export type ReaderInlineSegment =',
    "  | { type: 'text'; text: string }",
    "  | { type: 'ruby'; base: string; reading: string };",
    '',
    'export type ReaderParagraph = {',
    '  text: string;',
    '  segments: ReaderInlineSegment[];',
    '};',
    '',
    'export type ReaderChapter = {',
    '  id: string;',
    '  title: string;',
    '  paragraphs: ReaderParagraph[];',
    '  wordCount: number;',
    '  tokenFile: string;',
    '};',
    '',
    'export type ReaderBook = {',
    '  id: string;',
    '  sourceFile: string;',
    '  title: string;',
    '  author: string;',
    '  language: string;',
    '  chapterCount: number;',
    '  chapters: ReaderChapter[];',
    '};',
    '',
    `export const readerBook: ReaderBook = ${JSON.stringify(lightweightBook, null, 2)};`,
    '',
  ].join('\n');

  fs.writeFileSync(outputPath, fileContents, 'utf8');
}

function writeTokenManifest(tokenFiles) {
  const lines = [
    "import type { ReaderToken } from '@/data/book-data';",
    '',
    'export const chapterTokenFiles: Record<string, ReaderToken[][]> = {',
    ...tokenFiles.map(
      (tokenFile) => `  '${tokenFile}': require('@/data/${tokenFile}') as ReaderToken[][],`
    ),
    '};',
    '',
  ];

  fs.writeFileSync(tokenManifestPath, lines.join('\n'), 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
