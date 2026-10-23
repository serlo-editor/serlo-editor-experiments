# 6. Rich-text fragment bridge

Stage 1: Prepare backend.
Paths below are relative to experiment root unless marked as prototype paths.

Relevant prototype files: `src/editor/rich-text/create-editor.ts`,
`src/editor/store/editor-store.ts`, `src/editor/operations/load.ts`, and
`src/editor/operations/save.ts`.

- [x] Represent rich-text leaves using stable IDs resolving to `Y.XmlFragment` on
      same `Y.Doc` as structural storage. Reuse existing ProseKit/y-prosemirror
      binding rather than replacing rich text with JSON cells.
- [x] Define fragment initialization from external JSON, reopening without
      resetting content, and export of current fragment content to JSON.
- [x] Cache editor instances locally in storage. Keep definitions/extensions local
      and Yjs outside `src/rich-text/`. Preserve editor-specific awareness filtering
      by stable ID using caller-owned shared awareness.
- [x] Connect rich-text updates to revision contract and unsubscribe UI listeners.
- [ ] Define cleanup of cached editor instances and unused fragments. Disposal API
      intentionally deferred; callers currently unmount views and stores follow
      document lifetime.
- [ ] Migrate prototype consumers to the new rich-text schema and store APIs.

**Done when:** corresponding rich-text leaves bind same logical fragment across
replicas; typing, formatting, concurrent edits, and cursor awareness still work.
