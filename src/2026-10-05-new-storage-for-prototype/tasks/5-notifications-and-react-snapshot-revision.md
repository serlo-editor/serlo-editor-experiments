# 5. Notifications and React snapshot revision

Stage 1: Prepare backend.
Paths below are relative to experiment root unless marked as prototype paths.

Relevant files: storage contract/implementations and prototype's
`src/editor/store/use-editor-store.ts`.

- [ ] Provide subscription with unsubscribe plus stable revision/snapshot
      semantics for structural changes. Implement equivalent behavior for flat
      storage and Yjs, including received Yjs updates.
- [ ] Specify how editor adapter combines structural notifications, rich-text
      changes, and local selection/toolbar changes.
- [ ] Use local revision for UI invalidation; replicated `updateCount` is not
      required. Snapshot stays stable between changes and changes after relevant
      update.
- [ ] Check subscription cleanup and reopening without duplicate listeners.

**Done when:** direct handle edits and remote edits invalidate consumer snapshots;
selection-only changes update UI without writing content metadata.
