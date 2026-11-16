# Content types demo

Port of `2026-11-02-demo-version` onto this experiment's block/schema/store editor. Source experiment stays unchanged. Seven exercise types have collaborative authoring and local, interactive learner previews. Each type has its own synchronized room; offline fallback uses BroadcastChannel.

```sh
bun run dev
bun run fix
bun run build
```

- `src/editor/schema`, `src/editor/store`, `src/editor/rich-text`: existing editor foundation.
- `src/editor/content`, `src/editor/components`, `src/editor/session.ts`: demo content definitions, authoring views and Yjs session.
- `src/demo`: seeded exercises, session/presence management and learner previews.

This port supports bold, italic, headings, lists and gap marks. Advanced rich-text tools from the older demo are not supported by the new rich-text schema. Learner answers remain local to the preview; resetting or switching exercise types resets those answers. See `FINDINGS.md` for changes and recommendations.
