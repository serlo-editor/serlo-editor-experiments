# Reimplementation findings

Source: `src/2026-11-09-second-attempt-with-pi/` (`/in` does not exist). Reimplemented four worksheet modes, text/gap/multiple-choice blocks, grading, feedback comments and overrides, overall feedback, JSON inspector, and downstream resets. Existing `src/editor/schema`, `rich-text`, `store`, and `worksheet` implementations remain unchanged.

## Changes made and why

- Added prototype blocks, components, response schemas, and CSS under `src/editor/`. These are application UI on top of existing core; retained original rendering and grading behavior.
- Adapted imports and `src/demo/App.tsx` to target layout and APIs: `store` became `createStore`, `feedback` became `feedbacks`, and each document now has its own root. Each mode switch snapshots documents, resets downstream data, creates a fresh `FlatNodeStore`, remounts editor, and disposes previous worksheet. `createStore` is called only for active document; inactive documents use core's read-only stores.
- Used `WorksheetRevisionProvider` and existing `useStorage` rather than copying prototype's context/subscription helpers. Used `record.snapshot()` for choice/gap lookups because target `StoredRecord` has no `get`. Overall feedback uses `getOrCreate` only after checking snapshot for existing key; no new entry is written in locked modes.
- Added `@editor/*` mapping to `tsconfig.json`: existing core already imports through this alias but target had no mapping. Fixed HTML stylesheet paths and font URL for `src/editor/` location. Existing demo fixture and browser tests were reused.

## Simplifications worth trying

1. Add read-only `get(key)` to `StoredRecord`. Avoid serializing whole record for individual choice values and overall feedback lookup, and avoid using `getOrCreate` for reads. Keep current snapshot approach until this is needed elsewhere.
2. Move mode snapshot/reset policy into a session helper accepting reset rules. Target `useWorksheetSession` already switches and disposes stores, but does not clear answers/feedback when navigating backward; demo currently keeps this policy in `nextSnapshot`. Avoid two competing switch implementations if more consumers appear.
3. Type worksheet context against application schemas (or expose a typed exercise resolver) instead of default tagged records and `__overall` convention. Only needed if more non-exercise feedback kinds emerge.
4. Separate read-only rich-text rendering from ProseMirror editor construction if large worksheets make locked-mode initialization costly; current store builds editors even for static previews.

Flat store demo has no persistence, access control, or collaboration; JSON inspector exposes solutions. For Yjs, provide fresh document/awareness per mode and release caller-owned transport on switch. Tests: `bun run fix`, `bun run build`, and `BUN_CHROME_PATH=... bun run test:e2e` pass from this package.
