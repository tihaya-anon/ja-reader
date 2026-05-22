# Japanese Reader Roadmap

## Phase 1: Core Reader

- Support importing and opening EPUB files.
- Build a clean reading view with pagination or smooth chapter navigation.
  Status: in progress. Current UI is a minimal flowing-text reader with chapter-backed content, but not a finished pagination or chapter navigation experience.
- Preserve reading progress, current chapter, and last position.
  Status: partially complete. Current chapter and paragraph position exist in memory only.
- Add basic text selection, tap interaction, and responsive mobile layout.
  Status: complete for the current MVP. Single tap selects a word-like token, double tap selects a sentence, and the reading surface has been simplified into a reader-style text flow.

## Phase 2: Japanese Text Processing

- Add Japanese tokenization / word segmentation for the current sentence or paragraph.
  Status: complete for the current heuristic tokenizer. The app tokenizes paragraph text and maps taps back to token offsets.
- Support tapping a word to view base form, reading, and simple grammar-related metadata.
  Status: partially complete. Tap selection works and ruby readings from the EPUB are preserved and rendered, but dictionary-backed metadata and grammar detail are not implemented.
- Make tokenization fast enough to run during reading without breaking flow.
- Prepare a text-processing pipeline that can later support better analyzers or offline parsing.
  Status: in progress. EPUB preprocessing now preserves inline ruby/furigana segments and generates richer paragraph data for the app.

## Phase 3: Dictionary System

- Support importing external dictionaries such as MDX and MDD.
- Build a unified dictionary lookup layer so built-in and imported dictionaries use the same UI.
- Show word definitions in a popup / side panel while staying on the current page.
- Support multiple dictionaries, priority order, and optional cross-dictionary search.

## Phase 4: Notes and Bookmarks

- Add bookmarks for page, paragraph, sentence, or selected text.
- Add notes linked to exact reading context.
- Support quick note creation while reading with minimal interruption.
- Provide a library view for reviewing, editing, filtering, and searching notes/bookmarks.

## Phase 5: AI Context Integration

- Allow sending the current page, selected text, or surrounding paragraph as AI context.
- Support common reading actions such as translation, explanation, summary, and grammar breakdown.
- Make the context boundary explicit so users know exactly what is sent.
- Keep AI features modular so different providers or local models can be added later.

## Phase 6: Split-Screen Reading Workspace

- Support flexible split layouts such as original text + notes + keyboard, or text + dictionary + AI.
- Make panels resizable and easy to switch depending on reading mode.
- Optimize for both tablet-style multitasking and phone-sized constrained layouts.
- Preserve layout presets for different workflows.

## Phase 7: Library and Data Layer

- Build a local library for books, dictionaries, notes, bookmarks, and reading history.
- Define import/export flows so user data is portable and backup-friendly.
- Design storage with offline-first behavior as a baseline.
- Prepare for sync support later without coupling the first version to cloud requirements.

## Phase 8: Polish and Advanced Features

- Improve performance on large EPUBs and large dictionary files.
- Add search across books, notes, and dictionaries.
- Add keyboard shortcuts, gesture support, and accessibility improvements.
- Explore advanced features such as sentence mining, vocabulary review, and spaced repetition integration.

## Suggested Build Order

1. EPUB reading and progress tracking
2. Japanese tokenization and tap lookup
3. Dictionary import and lookup UI
4. Notes and bookmarks
5. AI context actions
6. Split-screen workspace
7. Data portability, search, and polish
