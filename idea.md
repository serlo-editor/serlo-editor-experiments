# Idea: `useWorksheetSession()`

Own opening, observing, and switching worksheet modes in one React hook. Keep `openWorksheet()` as low-level operation; do not restore generic `useStorage()` hook.

## Behavior

- Open worksheet once for initial mode and snapshots. Retain writable `NodeStore` created by `openWorksheet()`; `ViewingFeedback` has no writable store.
- Subscribe to active store with `useSyncExternalStore()`. Use `store.getRevision()` as numeric snapshot. Store changes rerender current worksheet **without reopening it**.
- On `switchMode(nextMode)`, read current `content.snapshot()`, `answers.snapshot()`, and `feedbacks.snapshot()`. Open new worksheet from those snapshots, replace session, and subscribe to its writable store.
- No-op when requested mode already active. Mode switch changes worksheet identity; ordinary edits do not.

## Sketch

```ts
function useWorksheetSession(options) {
  function open(mode, snapshots) {
    let writableStore
    const worksheet = openWorksheet({
      ...options,
      mode,
      initialSnapshot: snapshots,
      createStore: () => (writableStore = options.createStore()),
    })
    return { worksheet, writableStore }
  }

  const [session, setSession] = useState(() => open(options.mode, options.initialSnapshot))

  const revision = useSyncExternalStore(
    stableSubscribeFor(session.writableStore),
    stableGetRevisionFor(session.writableStore),
  )

  function switchMode(nextMode) {
    const current = latestSession()
    if (current.worksheet.mode === nextMode) return

    const { content, answers, feedbacks } = current.worksheet
    replaceSession(
      open(nextMode, {
        content: content.snapshot(),
        answers: answers.snapshot(),
        feedbacks: feedbacks.snapshot(),
      }),
    )
  }

  return { worksheet: session.worksheet, revision, switchMode }
}
```

`stableSubscribeFor` and `stableGetRevisionFor` represent callbacks stable while store identity stays unchanged. Missing writable store subscribes to nothing and reports revision `0`. `latestSession()` / `replaceSession()` must handle consecutive mode changes before next React render without using stale closures. Sketch illustrates behavior, not drop-in implementation.

## Delivering rerenders to worksheet consumers

`useSyncExternalStore()` rerenders component calling `useWorksheetSession()`. Existing `WorksheetContext` holds only worksheet object; providing same object on edit will **not** notify memoized context consumers. Choose one:

1. **Revision context:** Provider supplies existing worksheet context and separate numeric revision context. `useWorksheet()` consumes both. One store subscription; no new context object per edit.
2. **Consumer subscription:** Provider supplies `{ worksheet, writableStore }` once per session. `useWorksheet()` subscribes to store directly; remove subscription from `useWorksheetSession()`. No new context object per edit, but one subscription per consumer.
3. **Fresh worksheet context value:** Provider spreads worksheet into new context value each revision. Simplest wiring, but allocates object and notifies every consumer on provider rerenders.

Prefer revision context if hook owns subscription; prefer consumer subscription if avoiding second context matters more than subscription count.

## Boundaries to decide before implementation

- `ReadonlyNodeStore` never changes after opening. Upstream changes to readonly content or feedback require explicit reopen or live readonly views; active writable-store subscription cannot detect them.
- `openRoot()` uses `root.getOrCreate()`: if factory returns store with existing root, transition snapshots do **not** overwrite it. Ensure mode/store ownership and persistence semantics match intended snapshot behavior.
- Replacing `YjsNodeStore` instances against same `Y.Doc` currently accumulates `afterTransaction` listeners; add cleanup or reuse stores. Reopening rich-text editors can also reset editor state.
- React Strict Mode may run state initializers more than once. Opening side-effectful/persistent stores during render needs lifecycle design.
- `exercise.tsx` calls `getOrCreate()` during render. Missing feedback in readonly `ViewingFeedback` needs initialization before transition or read-only fallback.
- Define whether changes to initial options after mount trigger explicit reopen; do not silently reset active edits.
- `key` by session generation only if complete child UI remount on mode change is desired.
