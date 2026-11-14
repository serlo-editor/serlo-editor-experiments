# Findings

- No changes to `src/editor/` were needed. Existing `openWorksheet`, flat/read-only stores, rich-text schemas, and ProseKit editors support this fixed worksheet. Demo supplies document schemas, mode resets, grading, and presentation outside editor core.
- Existing demo targeted editor modules (`editor/blocks`, `editor/components`, `editor/responses`) absent from this attempt. Replaced demo and fixture with schemas backed by current editor API. Added `@editor/*` resolution to `tsconfig.json` so app and existing editor code type-check; removed dead stylesheet links in `src/index.html`.
- Existing `exercise()` helper calls `getOrCreate` on read-only answer/feedback records in feedback modes; missing records would throw. Demo uses explicit snapshot grading before opening feedback mode and leaves unanswered answer records untouched, rather than changing shared editor behavior for this experiment. Feedback view never creates assessments.
- Current editor provides storage and rich-text primitives, not a ready-made worksheet UI. Demo renders fixed items and controls directly; IDs stay in content snapshots across store replacement. Inspector deliberately exposes solutions. Session is memory-only.
- Existing WebView E2E file was adapted to current ProseKit DOM and nested answer schema. No new spec files were created.
