# 3. Create versus open document

Stage 1: Prepare backend. [Task index](../TASKS.md).
Paths below are relative to experiment root unless marked as prototype paths.

Relevant files: `src/schema/document.ts`, `src/storage/types.ts`,
`src/storage/yjs.ts`, `src/storage/flat.ts`.

- [ ] Add backend-neutral access to attached root and binding/opening of existing
      document. Flat store must remember its attached root too.
- [ ] Define empty-document behavior so consumer can wait for sync or initialize
      explicitly; opening must never create or overwrite content.
- [ ] Initialize root once after checking absence. Preserve prototype's current
      single-initializer setup; document independent concurrent initialization as
      unsupported unless deliberately implemented.
- [ ] Ensure opening synchronized content reconstructs handles from receiving
      document rather than retaining refs from sending replica.

**Done when:** receiving peer and newly constructed store can open existing root,
read same content, and edit it without writing new root during opening.
