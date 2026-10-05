# 6. Rich-text fragment bridge

Stage 1: Prepare backend. [Task index](../TASKS.md).
Paths below are relative to experiment root unless marked as prototype paths.

Relevant prototype files: `src/editor/rich-text/create-editor.ts`,
`src/editor/store/editor-store.ts`, `src/editor/operations/load.ts`, and
`src/editor/operations/save.ts`.

- [ ] Represent rich-text leaves using stable IDs resolving to `Y.XmlFragment` on
      same `Y.Doc` as structural storage. Reuse existing ProseKit/y-prosemirror
      binding rather than replacing rich text with JSON cells.
- [ ] Define fragment initialization from external JSON, reopening without
      resetting content, and export of current fragment content to JSON.
- [ ] Keep editor instances, feature configuration, and awareness outside generic
      storage. Preserve editor-specific awareness filtering by stable ID.
- [ ] Connect rich-text updates to revision contract and define cleanup of local
      editor instances/subscriptions when no longer used.

**Done when:** corresponding rich-text leaves bind same logical fragment across
replicas; typing, formatting, concurrent edits, and cursor awareness still work.
