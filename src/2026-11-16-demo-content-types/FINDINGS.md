# Findings

## Changes made

- Ported all seven old demo exercise types, authoring views, learner checks, initial content, presence and per-type sessions to new `block` / `discriminatedUnion` / `openRoot` / `YjsNodeStore` API. Gave rooms a new prefix to avoid sharing incompatible Yjs roots with old demo. Reused existing schema, store, rich-text implementation and copied demo CSS. Old editor/storage and old unit/handle implementations were **not** copied.
- Changed existing editor foundation only in `src/editor/schema/primitives.ts` and `src/editor/schema/index.ts`: added/exported finite-number schema for image coordinates and free-text minimum length. Added number test.
- Added `@editor/*` path mapping in `tsconfig.json`. New editor already imported this alias, but package had no mapping: `bun run fix` could not type-check before it was added.
- Added demo seed/collaboration round-trip test. Verified `bun run fix`, build and browser authoring-to-preview updates.

## Complications and recommendations

- New rich-text definition lacks old link, code, math, media, table, spoiler and box nodes, plus old static renderer. Port uses only supported bold/italic/headings/lists/gaps; preview serializes those nodes with ProseMirror. **Restore extensions only when those authoring tools are required**, rather than copying entire old rich-text implementation.
- `exercise()` / `useWorksheetSession()` model writable answers and feedback in separate stores with worksheet modes. Old demo keeps learner answers transient in React and edits content alongside preview. Wiring worksheet modes here would duplicate state, disrupt collaboration and require separate grading schemas for each exercise. **Keep preview-local answers for this demo**; adopt worksheet mode when persistent/shared answers or feedback are a requirement.
- New stored object fields are properties, not old `.field()` handles, and rich text is editor-backed. Ported UI uses `StoredValueOf` and `BlockView` directly rather than an adapter for old handles. **Expose stable typed selectors or a local subscription hook only if additional demos need them.** For now parent subscribes to whole content store; optimize only after measuring render cost.
- `discriminatedUnion` already needs internal type assertions and new `BlockView` has parent-owned invalidation. Neither needed another change for this demo. Avoid expanding editor foundation solely for UI convenience.
