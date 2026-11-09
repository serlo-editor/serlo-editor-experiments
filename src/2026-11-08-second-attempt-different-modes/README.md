# Worksheet modes with reconstructed editors

This experiment rebuilds the four-mode workflow from
`2026-11-04-first-attempt-different-modes` on top of the copied `src/current/`
schema and storage implementation. The earlier experiment remains unchanged.

## Run and check

```sh
bun dev
bun run fix
bun run build
```

## Browser E2E

On this workstation, run the existing Bun.WebView E2E suite with the MS
Playwright-installed headless shell (not the Playwright API):

```sh
BUN_CHROME_PATH="$HOME/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell" bun run test:e2e
```

The Linux browser backend starts with `--no-sandbox` and
`--disable-dev-shm-usage`. The test builds a bundled HTML fixture under `dist/`,
opens fresh browser views, and removes the fixture afterward. Browser E2E runs
separately from `bun test` and `bun run fix`.

## Workflow

The two editors in the demo are synchronized Yjs peers. The right pane can
instead display the three document snapshots as JSON.

1. **Inhalt bearbeiten:** edit content, gaps, and correct choices.
2. **Aufgaben lösen:** enter gap answers and select choices.
3. **Feedback geben:** inspect automatic assessments, override grades, and
   collaborate on formatted exercise comments and overall feedback.
4. **Feedback ansehen:** inspect answers and feedback without editing them.

| Mode             | Content            | Answers            | Feedback           |
| ---------------- | ------------------ | ------------------ | ------------------ |
| Authoring        | Yjs writable       | Read-only snapshot | Read-only snapshot |
| Answering        | Read-only snapshot | Yjs writable       | Read-only snapshot |
| Adding feedback  | Read-only snapshot | Read-only snapshot | Yjs writable       |
| Viewing feedback | Read-only snapshot | Read-only snapshot | Read-only snapshot |

Every actual mode switch takes the current worksheet snapshot from the first
editor, creates **two new editors** with new Yjs documents and stores, and
initializes both from that snapshot. The peers synchronize within the active
mode. Nothing is cleared when switching back to content or answers: content,
answers, comments, manual grades, and overall feedback travel together. Clicking
the active mode does nothing. A read-only document is an immutable snapshot,
not a live projection of a previous Yjs document.

The `Editor` component receives `mode`, `snapshot`, and the Yjs `store`. It
opens the worksheet with `openWorksheet()` using the copied storage/schema
core. The current mode selects the only writable document; other documents
use `ReadonlyNodeStore`. `EditorHandle.snapshot()` exposes the latest combined
snapshot for the next mode switch. Content block IDs connect exercises to
answer and feedback records. Gap and choice IDs connect responses to content.

On first entry into feedback, missing feedback records receive automatic
assessments. Re-entering feedback refreshes automatic results while preserving
manual overrides and comments. Feedback is not recreated on each visit.

## Implementation and limits

- `src/editor/worksheet.ts`: mode permissions and worksheet snapshot shape.
- `src/editor/schema/exercise.tsx`: joins exercises to answers and feedback.
- `src/editor/blocks/`, `components/`, `responses.ts`: four-mode UI and response
  schemas.
- `src/editor/storage/`, `schema/`, `rich-text/`: copied editor core.
- `src/demo/sessions.ts`, `sync-cdrts.ts`, `App.tsx`: per-mode Yjs peer pair,
  snapshot handoff, controls, and inspector.

New mode sessions discard old Yjs history and awareness; only JSON worksheet
snapshots survive a switch. There is no persistent database or authorization
boundary: the debug JSON includes solutions. Editing content with existing
answers does not migrate those answers; stable IDs keep their associations,
while changed exercise semantics may make prior answers stale.
