# Worksheet modes with new stores

Uses copied `src/current/` core in `editor/` and reuses rendering, blocks, styles, and fixture from `2026-11-04-first-attempt-different-modes`. See [FINDINGS.md](./FINDINGS.md) for required core changes and limits.

```sh
bun run dev
bun run fix
bun run build
BUN_CHROME_PATH="$HOME/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell" bun run test:e2e
```

Modes: author content → answer exercises → give graded feedback → view feedback. One writable worksheet document per mode; other documents are immutable snapshots. Mode switching saves snapshots, resets later-stage data when returning to earlier modes, and constructs a fresh store, worksheet, and editor. Editing an already selected mode does nothing. Feedback includes automatic results, overrides, rich-text comments, and overall feedback. JSON inspector exposes each document; not suitable for student-facing authorization.

The demo uses `FlatNodeStore`; `openWorksheet` takes any `NodeStore` including `YjsNodeStore`. For collaborative use, caller manages Yjs session/transport lifetime and recreates it on each mode switch. No persistent Yjs session or collaboration pair in this demo.
