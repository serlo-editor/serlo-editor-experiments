# Storage replacement tasks

Goal and boundaries: [README.md](./README.md).
All tasks start unchecked. Backend preparation belongs in this experiment;
prototype migration is a separate integration stage. Original
`2026-09-26-content-storage-with-kernel` experiment remains unchanged.

## Stage 1: Prepare backend

### 1. Package identity and shared dependencies

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

### 2. Define node identity and traversal contract

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

### 3. Create versus open document

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

### 4. Transactions and synchronization

Relevant files: `src/storage/types.ts`, `src/storage/yjs.ts`,
`src/storage/flat.ts`, and prototype's `src/demo/sync-cdrts.ts`.

- [ ] Define local transaction origin compatible with prototype transport, or
      change transport to distinguish local and received transactions explicitly.
      Backend edits with null origin currently get dropped by prototype helper.
- [ ] Cover root attachment and all schema mutations, not only cell updates.
- [ ] Preserve grouped/nested editor operations and return values; observers must
      see completed operations rather than partially attached content.
- [ ] Specify error semantics. Existing stores do not provide rollback; do not
      promise it merely because API is called `transact`.
- [ ] Add two-document checks for initialization, cell changes, array insertion/
      removal, and object edits using same forwarding rules as consumer.

**Done when:** edits propagate both directions, grouped updates expose consistent
state, and received updates do not create forwarding loops.

### 5. Notifications and React snapshot revision

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

### 6. Rich-text fragment bridge

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

### 7. Complete prototype schema compatibility

Relevant files: `src/schema/` and prototype's `src/editor/schema/index.ts`,
`src/editor/content/index.tsx`.

- [ ] Choose kernel schema implementations or explicit editor-side translation;
      document choice and avoid maintaining two competing content stores.
- [ ] Support literals, including preservation/validation of content type tags.
- [ ] Support wrappers with `wrap`/`unwrap` semantics and matching external JSON.
- [ ] Support unions with reliable selected-variant resolution after reopening.
- [ ] Integrate rich-text bridge into typed traversal and content import/export.
- [ ] Preserve existing boolean, array, object, and optional-field behavior.
- [ ] Validate malformed external JSON at import boundary without replacing
      existing root. Keep rendering options (`customBehavior`, `keyOrder`,
      `htmlTag`, `className`) outside storage.

**Done when:** prototype's complete initial content imports/exports without shape
changes, all content variants traverse correctly, and boolean/rich-text edits
appear in exported JSON. Invalid imports do not destroy existing document.

## Stage 2: Integrate prototype

These tasks require changes in `2026-10-05-current-prototype`, not just this
experiment. Start after backend contracts and compatibility checks are ready.

### 8. Replace storage access

- [ ] Construct new store on existing `CDRT.doc`; retain awareness.
- [ ] Adapt `src/editor/store/editor-store.ts` to use new backend. Keep local
      selection and editor cache there; retire legacy content tables once unused.
- [ ] Replace `Y.Array<Key>` / `Y.Map<Key>` assumptions in schema value types,
      `src/editor/nodes/flat.ts`, and load/save operations with chosen refs/handles.
- [ ] Update root initialization/rendering in `src/editor/components/Editor.tsx`
      to create or open correctly.
- [ ] Update React hook to new revision contract, toolbar lookup to chosen
      identity API, and rich-text creation to fragment bridge.
- [ ] Adapt custom renderers and `src/demo/DebugPanel.tsx` to new traversal,
      external JSON export, and local selection.
- [ ] Update sync helper and dependency wiring agreed in Stage 1. Remove obsolete
      helpers only after callers migrate.

**Done when:** structural reads/writes use this backend rather than parallel
legacy maps; prototype loads both editors and debug views correctly.

### 9. Verify replacement end to end

- [ ] Run shared contract/schema tests against both stores; add regression checks
      alongside new non-trivial behavior.
- [ ] Add consumer compatibility test using full initial content and existing
      document reopening.
- [ ] Add browser-level checks for initial rendering, checkbox sync both ways,
      typing in normal text and multiple-choice question, bold/italic/gap
      formatting, toolbar focus, cursor filtering, and debug JSON updates.
- [ ] Check remote structural edits trigger React rerender without legacy counter.
- [ ] Check concurrent edits converge and reopening does not reset fragments or
      duplicate structural content.
- [ ] Run `pnpm fix` here and `bun run fix` from repository root. After prototype
      code changes, follow prototype's `AGENTS.md`; if its referenced e2e command
      is absent, provide runnable browser check rather than claiming it passed.
- [ ] Update README to describe implemented API, import example, and remaining
      limitations. Only mark tasks complete after acceptance checks pass.

**Replacement ready when:** prototype preserves external JSON and collaborative
behavior while using new backend for structural content. No durable persistence
or migration of old internal Yjs layout required for this milestone.
