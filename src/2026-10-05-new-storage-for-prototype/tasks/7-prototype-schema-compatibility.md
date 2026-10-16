# 7. Complete prototype schema compatibility

Stage 1: Prepare backend.
Paths below are relative to experiment root unless marked as prototype paths.

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
