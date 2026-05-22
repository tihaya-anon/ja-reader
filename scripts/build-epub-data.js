const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const dataDirectory = path.join(projectRoot, 'data');
const outputPath = path.join(projectRoot, 'data', 'book-data.ts');

function main() {
  const epubPath = findFirstEpub(dataDirectory);

  if (!epubPath) {
    throw new Error(`No EPUB file found in ${dataDirectory}`);
  }

  const book = parseEpubWithPython(epubPath);
  const fileContents = [
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
    `export const readerBook: ReaderBook = ${JSON.stringify(book, null, 2)};`,
    '',
  ].join('\n');

  fs.writeFileSync(outputPath, fileContents, 'utf8');
  console.log(`Wrote ${path.relative(projectRoot, outputPath)} from ${path.basename(epubPath)}`);
}

function findFirstEpub(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const fileEntry = entries.find((entry) => entry.isFile() && entry.name.endsWith('.epub'));
  return fileEntry ? path.join(directoryPath, fileEntry.name) : null;
}

function parseEpubWithPython(epubPath) {
  const { spawnSync } = require('node:child_process');
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

main();
