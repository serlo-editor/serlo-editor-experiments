# 1. Package identity and shared dependencies

Stage 1: Prepare backend. [Task index](../TASKS.md).
Paths below are relative to experiment root unless marked as prototype paths.

- [ ] Rename package to `2026-10-05-new-storage-for-prototype`; update relevant
      lockfile metadata.
- [ ] Provide a small public entry point exporting stores, document APIs, schema
      factories, and types needed by consumer. Avoid private-file imports.
- [ ] Fix test-type setup so standalone package check resolves `bun:test` and
      repository check resolves Bun type definitions. Keep scripts runnable from
      documented working directories.
- [ ] Align Yjs dependency with prototype and ensure consumer, backend, and
      rich-text binding resolve one runtime instance. Coordinate prototype-side
      dependency changes during integration.

**Done when:** consumer import compiles and store can attach its shared types to
prototype-created `Y.Doc` without duplicate-Yjs warning or
`Unexpected content type` error.
