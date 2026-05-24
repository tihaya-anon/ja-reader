# Reader MVP

This repository is an Expo v54 prototype for a Japanese reading app.

Current MVP scope:

- Load an EPUB from local `data/`
- Preprocess EPUB chapters into app-readable data
- Show chapter-based reading UI
- Track in-memory reading progress
- Support inline token selection and ruby display
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

3. Rebuild local reader data

   ```bash
   node scripts/build-epub-data.js
   ```

   This generates local files inside `data/`, including lightweight chapter metadata, per-chapter token JSON, and local dictionary lookup data when an `.mdx` file exists in `data/dict/`.

4. Start Expo

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

VS Code / Cursor can open the repository with the config in [.devcontainer/devcontainer.json](/workspace/.devcontainer/devcontainer.json).

## Data Flow

- Local source EPUB: `data/*.epub`
- Preprocess script: [scripts/build-epub-data.js](/workspace/scripts/build-epub-data.js)
- EPUB parser: [scripts/parse_epub.py](/workspace/scripts/parse_epub.py)
- Generated chapter metadata: `data/book-data.ts`
- Generated chapter token files: `data/book-tokens/*.json`
- Generated dictionary lookup data: `data/dictionary-data.ts`

## Current Limitations

- `data/` must be generated locally and is not distributed with the repo
- `kuromoji` is used for lightweight reading-oriented tokenization, not full dictionary lookup on its own
- Ruby rendering prefers EPUB-provided ruby; tokenizer readings are supporting metadata
- Reading progress is not persisted yet
- EPUB import is preprocessed at build time, not yet handled live inside the app
- Notes, bookmarks, AI context, and dictionaries are not implemented yet
