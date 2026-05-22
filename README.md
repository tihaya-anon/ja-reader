# Reader MVP

This repository is now an Expo v54 prototype for a Japanese reading app.

Current MVP scope:

- Load the EPUB already placed in `./data`
- Preprocess EPUB chapters into app-readable TypeScript data
- Show chapter-based reading UI
- Track in-memory reading progress
- Re-tokenize the selected paragraph and inspect token clusters

## Run

1. Install dependencies

   ```bash
   npm install
   ```

2. Rebuild the bundled book data if the EPUB in `./data` changes

   ```bash
   node scripts/build-epub-data.js
   ```

3. Start Expo

   ```bash
   npm run start
   ```

## Data Flow

- Source EPUB: `data/*.epub`
- Preprocess script: [scripts/build-epub-data.js](/home/labuser/proj/reader/scripts/build-epub-data.js)
- EPUB parser: [scripts/parse_epub.py](/home/labuser/proj/reader/scripts/parse_epub.py)
- Generated app data: [data/book-data.ts](/home/labuser/proj/reader/data/book-data.ts)

## Current Limitations

- Tokenization is heuristic grouping, not a full Japanese morphological analyzer
- Reading progress is not persisted yet
- EPUB import is preprocessed at build time, not yet handled live inside the app
- Notes, bookmarks, AI context, and dictionaries are not implemented yet
