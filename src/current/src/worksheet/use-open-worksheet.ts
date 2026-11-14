import type { AnySchema, StoredValueOf } from "@editor/schema"
import type { NodeRefs } from "@editor/storage"
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react"

import { openWorksheet, type Worksheet, type WorksheetOptions, WorksheetMode } from "./worksheet.ts"

/** Opens a worksheet once; store changes rerender, mode changes reopen from current snapshots. */
export function useOpenWorksheet<
  ContentSchema extends AnySchema,
  AnswersSchema extends AnySchema,
  FeedbacksSchema extends AnySchema,
  Refs extends NodeRefs,
>(options: WorksheetOptions<ContentSchema, AnswersSchema, FeedbacksSchema, Refs>) {
  type Opened = Worksheet<
    StoredValueOf<ContentSchema>,
    StoredValueOf<AnswersSchema>,
    StoredValueOf<FeedbacksSchema>
  >
  const [opened, setOpened] = useState<Opened>(() => openWorksheet(options))
  const current = useRef(opened)
  const initialOptions = useRef(options)

  const setMode = useCallback((mode: WorksheetMode) => {
    const previous = current.current
    if (mode === previous.mode) return
    const next = openWorksheet({
      ...initialOptions.current,
      mode,
      initialSnapshot: {
        content: previous.content.snapshot(),
        answers: previous.answers.snapshot(),
        feedbacks: previous.feedbacks.snapshot(),
      },
    })
    current.current = next
    setOpened(next)
  }, [])

  const store = opened.store
  const subscribe = useCallback(
    (listener: () => void) => store?.subscribe(listener) ?? (() => {}),
    [store],
  )
  const getRevision = useCallback(() => store?.getRevision() ?? 0, [store])
  const revision = useSyncExternalStore(subscribe, getRevision, getRevision)

  // New context value notifies memoized consumers without reopening bound values.
  const worksheet = useMemo(() => ({ ...opened }), [opened, revision])
  return { worksheet, setMode }
}
