# 8. Replace storage access

Stage 2: Integrate prototype. [Task index](../TASKS.md).
Work belongs in `2026-10-05-current-prototype`; paths below are relative to its root.
Start after backend contracts and compatibility checks are ready.

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
