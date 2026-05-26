# Japanese Reader Roadmap

## Phase 1: Core Reader

- Support importing and opening EPUB files.
- Build a clean reading view with pagination or smooth chapter navigation.
  Status: in progress. The app now has a more reader-like chapter surface with chapter header, progress bars, chapter navigation, paragraph markers, and floating controls, but it is still a flowing-text reader rather than a finished pagination system.
- Preserve reading progress, current chapter, and last position.
  Status: partially complete. Chapter and paragraph selection still live in memory only, but reader UI preferences for the lookup modal are now persisted locally.
- Add basic text selection, tap interaction, and responsive mobile layout.
  Status: complete for the current MVP. Single tap selects a token, double tap selects a sentence, and lookup now stays in a movable modal instead of pushing content downward.

## Phase 2: Japanese Text Processing

- Add Japanese tokenization / word segmentation for the current sentence or paragraph.
  Status: complete for the current heuristic tokenizer. The app tokenizes paragraph text and maps taps back to token offsets.
- Support tapping a word to view base form, reading, and simple grammar-related metadata.
  Status: in progress. Tap selection works, EPUB ruby is preserved, dictionary entries are shown in-modal, and missing ruby can now be backfilled from dictionary readings, but grammar detail is still shallow.
- Make tokenization fast enough to run during reading without breaking flow.
- Prepare a text-processing pipeline that can later support better analyzers or offline parsing.
  Status: in progress. EPUB preprocessing preserves inline ruby/furigana segments and dictionary generation now also extracts optional reading metadata for fallback ruby.

## Phase 3: Dictionary System

- Support importing external dictionaries such as MDX and MDD.
  Status: partially complete. Local MDX import exists for one dictionary source at build time.
- Build a unified dictionary lookup layer so built-in and imported dictionaries use the same UI.
  Status: in progress. Token lookup and dictionary-backed ruby fallback now share the same local dictionary data layer.
- Show word definitions in a popup / side panel while staying on the current page.
  Status: partially complete. Definitions now appear in a draggable and resizable modal that stays over the current reading view.
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
