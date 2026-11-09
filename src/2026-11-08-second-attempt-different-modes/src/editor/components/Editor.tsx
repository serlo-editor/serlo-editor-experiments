import { useCallback, useEffect, useImperativeHandle, useMemo, useState, type Ref } from "react"

import { FillInTheGapExercise, MultipleChoiceExercise, Root } from "../blocks"
import { gradeGap } from "../blocks/fill-in-the-gap"
import { gradeChoice } from "../blocks/multiple-choice"
import { OverallFeedback } from "../blocks/shared/feedback"
import { Answers, Feedback } from "../responses"
import type { RichTextEditor } from "../rich-text"
import { BlockView, isTaggedObject } from "../schema"
import type { RichTextId, YjsNodeStore } from "../storage"
import { useStorage } from "../use-storage"
import { openWorksheet, WorksheetMode } from "../worksheet"
import { WorksheetContext } from "../worksheet-context"
import type { WorksheetSnapshot } from "../worksheet-snapshot"
import { FocusContext } from "./RichText"
import { Toolbar } from "./Toolbar"

export interface EditorHandle {
  snapshot(): WorksheetSnapshot
}

export function Editor({
  mode,
  snapshot,
  store,
  name,
  color = "#5364c8",
  ref,
}: {
  mode: WorksheetMode
  snapshot: WorksheetSnapshot
  store: YjsNodeStore
  name: string
  color?: string
  ref?: Ref<EditorHandle>
}) {
  const worksheet = useMemo(
    () =>
      openWorksheet({
        mode,
        store,
        contentSchema: Root,
        answersSchema: Answers,
        feedbackSchema: Feedback,
        initialSnapshot: snapshot,
      }),
    [mode, snapshot, store],
  )
  useStorage(store)
  const [focused, setFocused] = useState<{ id: RichTextId; editor: RichTextEditor } | null>(null)
  useEffect(() => {
    if (mode !== WorksheetMode.GivingFeedback) return
    const exercises = worksheet.feedback.exercises
    for (const unit of worksheet.content.children()) {
      if (unit.type === "text") continue
      const entry = exercises.get(unit.id)
      if (!entry) continue
      const answer = worksheet.answers.get(unit.id)
      const automaticResult =
        unit.type === "fill-in-the-blank"
          ? gradeGap(
              unit,
              answer && isTaggedObject(FillInTheGapExercise.answer, answer) ? answer : undefined,
            )
          : gradeChoice(
              unit,
              answer && isTaggedObject(MultipleChoiceExercise.answer, answer) ? answer : undefined,
            )
      if (entry.automaticResult.get() !== automaticResult)
        entry.automaticResult.set(automaticResult)
    }
  }, [mode, worksheet])
  const updateFocus = useCallback((id: RichTextId, editor: RichTextEditor, hasFocus: boolean) => {
    setFocused((previous) => (hasFocus ? { id, editor } : previous?.id === id ? null : previous))
  }, [])
  useImperativeHandle(
    ref,
    () => ({
      snapshot: () => ({
        content: worksheet.content.snapshot(),
        answers: worksheet.answers.snapshot(),
        feedback: worksheet.feedback.snapshot(),
      }),
    }),
    [worksheet],
  )

  return (
    <form
      className="editor-card panel"
      aria-label={name}
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="editor-card__title">
        <span
          className="editor-card__accent"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {name}
      </h2>
      <section className="editor-frame surface">
        {(mode === WorksheetMode.EditingContent || mode === WorksheetMode.GivingFeedback) && (
          <div className="editor-toolbar-shell">
            <Toolbar editor={focused?.editor ?? null} />
          </div>
        )}
        <WorksheetContext value={worksheet}>
          <FocusContext value={updateFocus}>
            <div
              className={
                mode === WorksheetMode.EditingContent ? "editor-content" : "learner-content"
              }
            >
              {worksheet.content.map((value) => (
                <BlockView key={value.id} value={value} />
              ))}
              <OverallFeedback />
            </div>
          </FocusContext>
        </WorksheetContext>
      </section>
    </form>
  )
}
