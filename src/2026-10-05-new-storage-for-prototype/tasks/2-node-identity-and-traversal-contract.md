# 2. Define node identity and traversal contract

Stage 1: Prepare backend. [Task index](../TASKS.md).
Paths below are relative to experiment root unless marked as prototype paths.

Relevant files: `src/storage/types.ts`, `src/schema/types.ts`, and prototype's
`src/editor/store/editor-store.ts`, `src/editor/nodes/flat.ts`.

- [ ] Choose stable node IDs usable by React keys, editor caches, selection,
      fragment names, and awareness. Do not use array index, regenerated snapshot
      ID, or replica-local Yjs object identity as shared ID.
- [ ] Expose enough identity and traversal through handles or adapter to find
      nodes, resolve schema/union variant, access fields/items, and enumerate
      reachable nodes for debug views.
- [ ] Specify how IDs survive edits, reopening, and synchronization; distinguish
      new/replaced nodes from unchanged nodes.
- [ ] Keep schema registry and render metadata editor-side. Store only schema or
      variant metadata that cannot be derived reliably during traversal.
- [ ] Derive parent information/indexes unless existing consumer requires stored
      versions. Account for Yjs shared types having one owning location; do not
      insert same shared type into both tree and secondary index.

**Done when:** two replicas identify corresponding nodes consistently, unchanged
nodes retain identity after sibling insert/remove, and required lookups work
without legacy content tables.
