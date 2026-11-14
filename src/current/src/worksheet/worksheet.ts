import {
  type AnySchema,
  type SnapshotOf,
  type StoredRecord,
  type StoredValue,
  type StoredValueOf,
  openRoot,
  type TaggedObjectDefinition,
} from "@editor/schema"
import { ReadonlyNodeStore, type NodeRefs, type NodeStore } from "@editor/store"
import { useCallback, useRef, useState, useSyncExternalStore } from "react"

export enum WorksheetMode {
  EditingContent = "editing-content",
  Answering = "answering",
  GivingFeedback = "giving-feedback",
  ViewingFeedback = "viewing-feedback",
}

export interface WorksheetOptions<
  ContentSchema extends AnySchema,
  AnswersSchema extends AnySchema,
  FeedbacksSchema extends AnySchema,
  Refs extends NodeRefs,
> {
  mode: WorksheetMode
  /** Application selects backend and, for shared Y.Doc, combines editor identity with kind. */
  createStore: (kind: "content" | "answers" | "feedbacks") => NodeStore<Refs>
  contentSchema: ContentSchema
  answersSchema: AnswersSchema
  feedbacksSchema: FeedbacksSchema
  initialSnapshot: {
    content: SnapshotOf<ContentSchema>
    answers: SnapshotOf<AnswersSchema>
    feedbacks: SnapshotOf<FeedbacksSchema>
  }
}

export interface Worksheet<
  Content extends StoredValue = StoredValue,
  Answers extends StoredRecord<TaggedObjectDefinition<string, {}>> = StoredRecord<
    TaggedObjectDefinition<string, {}>
  >,
  Feedbacks extends StoredRecord<TaggedObjectDefinition<string, {}>> = StoredRecord<
    TaggedObjectDefinition<string, {}>
  >,
> {
  mode: WorksheetMode
  content: Content
  answers: Answers
  feedbacks: Feedbacks
  subscribe(listener: () => void): () => void
  getRevision(): number
  /** Releases stores opened by this worksheet, not caller-owned Y.Doc or awareness. */
  dispose(): void
}

export function useWorksheetSession<
  ContentSchema extends AnySchema,
  AnswersSchema extends AnySchema,
  FeedbacksSchema extends AnySchema,
  Refs extends NodeRefs,
>(options: WorksheetOptions<ContentSchema, AnswersSchema, FeedbacksSchema, Refs>) {
  type OpenWorksheet = ReturnType<
    typeof openWorksheet<ContentSchema, AnswersSchema, FeedbacksSchema, Refs>
  >
  type Session = { worksheet: OpenWorksheet }

  const open = useCallback(
    (
      mode: WorksheetMode,
      initialSnapshot: WorksheetOptions<
        ContentSchema,
        AnswersSchema,
        FeedbacksSchema,
        Refs
      >["initialSnapshot"],
    ): Session => ({
      worksheet: openWorksheet({ ...options, mode, initialSnapshot }),
    }),
    [options],
  )
  const sessionRef = useRef<Session | null>(null)
  if (sessionRef.current === null) sessionRef.current = open(options.mode, options.initialSnapshot)
  const [session, setSession] = useState(sessionRef.current)
  const worksheet = session.worksheet

  const revision = useSyncExternalStore(
    worksheet.subscribe,
    worksheet.getRevision,
    worksheet.getRevision,
  )

  const switchMode = useCallback(
    (nextMode: WorksheetMode) => {
      const current = sessionRef.current
      if (!current || current.worksheet.mode === nextMode) return

      const next = open(nextMode, {
        content: current.worksheet.content.snapshot(),
        answers: current.worksheet.answers.snapshot(),
        feedbacks: current.worksheet.feedbacks.snapshot(),
      })
      sessionRef.current = next
      setSession(next)
      current.worksheet.dispose()
    },
    [open],
  )

  return { worksheet, revision, switchMode }
}

export function openWorksheet<
  ContentSchema extends AnySchema,
  AnswersSchema extends AnySchema,
  FeedbacksSchema extends AnySchema,
  Refs extends NodeRefs,
>({
  mode,
  createStore,
  contentSchema,
  answersSchema,
  feedbacksSchema,
  initialSnapshot,
}: WorksheetOptions<ContentSchema, AnswersSchema, FeedbacksSchema, Refs>): Worksheet<
  StoredValueOf<ContentSchema>,
  StoredValueOf<AnswersSchema>,
  StoredValueOf<FeedbacksSchema>
> {
  const contentStore = mode === WorksheetMode.EditingContent ? createStore("content") : undefined
  const answersStore = mode === WorksheetMode.Answering ? createStore("answers") : undefined
  const feedbacksStore =
    mode === WorksheetMode.GivingFeedback ? createStore("feedbacks") : undefined

  const content = contentStore
    ? openRoot(contentStore, contentSchema, initialSnapshot.content)
    : openRoot(new ReadonlyNodeStore(), contentSchema, initialSnapshot.content)
  const answers = answersStore
    ? openRoot(answersStore, answersSchema, initialSnapshot.answers)
    : openRoot(new ReadonlyNodeStore(), answersSchema, initialSnapshot.answers)
  const feedbacks = feedbacksStore
    ? openRoot(feedbacksStore, feedbacksSchema, initialSnapshot.feedbacks)
    : openRoot(new ReadonlyNodeStore(), feedbacksSchema, initialSnapshot.feedbacks)

  // Maximal one store is active at a time, so we can use the first non-null store for revision tracking and subscriptions.
  const store = contentStore ?? answersStore ?? feedbacksStore
  const listeners = new Set<() => void>()
  const unsubscribe = store?.subscribe(() => {
    listeners.forEach((listener) => listener())
  })

  return {
    mode,
    content,
    answers,
    feedbacks,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getRevision() {
      return store?.getRevision() ?? 0
    },
    dispose() {
      unsubscribe?.()
      listeners.clear()
      store?.dispose()
    },
  }
}
