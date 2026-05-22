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

## Docker Dev Environment

The development container includes:

- Node.js 20
- Python 3 + `pip`
- Expo CLI and EAS CLI
- `codex` and `claude` CLIs
- `git-cliff`
- System tools commonly needed for EPUB/dictionary processing: `unzip`, `zip`, `sqlite3`, `git`, `ripgrep`, `jq`, build tools
- Python libraries that are likely useful for upcoming reader work: `ebooklib`, `beautifulsoup4`, `lxml`, `rapidfuzz`, `mistletoe`

Build:

```bash
docker build -t reader-dev .
```

Run:

```bash
docker run --rm -it -p 8081:8081 -p 19000:19000 -p 19001:19001 -p 19002:19002 reader-dev
```

## Dev Container

VS Code / Cursor can open the repository with the config in [.devcontainer/devcontainer.json](/home/labuser/proj/reader/.devcontainer/devcontainer.json).

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
