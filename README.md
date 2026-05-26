# Reader MVP

This repository is an Expo v54 prototype for a Japanese reading app.

Current MVP scope:

- Load an EPUB from local `data/`
- Preprocess EPUB chapters into app-readable data
- Show a chapter-based reading UI with chapter header and progress bars
- Support inline token selection, sentence selection, and ruby display
- Fill missing ruby from local dictionary readings when available
- Show local dictionary definitions in a draggable, resizable modal
- Persist reader UI settings for the lookup modal
- Tokenize with `kuromoji` for lookup-oriented reading data

## Run

1. Install dependencies

   ```bash
   npm install
   ```

2. Add your own EPUB to `./data`

   Notes:

   - `data/` is intentionally ignored by git and is treated as local reading content
   - source books and generated token data are not committed to the repository

3. Optionally add an `.mdx` dictionary to `./data/dict`

   Notes:

   - the build currently reads the first `.mdx` file it finds in `data/dict/`
   - dictionary definitions and ruby fallback data are generated locally and are not committed

4. Rebuild local reader data

   ```bash
   node scripts/build-epub-data.js
   ```

   This generates local files inside `data/`, including lightweight chapter metadata, per-chapter token JSON, and local dictionary lookup data when an `.mdx` file exists in `data/dict/`.

5. Start Expo

   ```bash
   npm run start
   ```

## Current Reader Behavior

- Single tap selects a token and opens dictionary lookup in a floating modal
- Double tap selects the surrounding sentence
- EPUB-provided ruby is preserved and rendered inline
- If a token contains kanji and the book did not provide ruby, the app tries to derive ruby from local dictionary entries
- EPUB ruby and dictionary-derived ruby use different colors in the reading view
- The lookup modal can be moved from the top-right handle and resized from the bottom-right handle
- Lookup modal position and size persist locally with AsyncStorage

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

VS Code / Cursor can open the repository with the config in [.devcontainer/devcontainer.json](/workspace/.devcontainer/devcontainer.json).

## Data Flow

- Local source EPUB: `data/*.epub`
- Preferred development sample: `data/dev-sample-ja.epub` when present
- Optional local dictionary: `data/dict/*.mdx`
- Preprocess script: [scripts/build-epub-data.js](/workspace/scripts/build-epub-data.js)
- EPUB parser: [scripts/parse_epub.py](/workspace/scripts/parse_epub.py)
- Generated chapter metadata: `data/book-data.ts`
- Generated chapter token files: `data/book-tokens/*.json`
- Generated dictionary lookup data: `data/dictionary-data.ts`

## Current Limitations

- `data/` must be generated locally and is not distributed with the repo
- the dictionary build currently supports one local `.mdx` source at a time
- dictionary reading extraction is heuristic and may vary by MDX format
- reading progress is still not persisted yet; only lookup modal UI settings are persisted
- EPUB import is preprocessed at build time, not yet handled live inside the app
- notes, bookmarks, AI context, and multi-dictionary management are not implemented yet
