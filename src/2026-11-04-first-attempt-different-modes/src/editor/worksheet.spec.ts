import { expect, test } from "bun:test"

import { initialContent } from "../demo/initial-content"
import { createDemoSessions } from "../demo/sessions"
import { FillInTheGapExercise } from "./blocks"
import { createWorksheet, prepareWorksheetMode, WorksheetMode } from "./worksheet"

test("mode views enforce write permissions while keeping all documents live", () => {
  const sessions = createDemoSessions(initialContent)
  try {
    const { first, second } = sessions
    const editing = createWorksheet(WorksheetMode.EditingContent, first)
    expect(editing.content.document.root.length).toBe(initialContent.length)
    expect(() =>
      editing.answers.document.root.set(
        "wrong",
        FillInTheGapExercise.answer.createSnapshot({ values: {} }),
      ),
    ).toThrow("Storage is read-only.")
    expect(() =>
      editing.feedback.document.root
        .field("overall")
        .getEditor()
        .setContent({
          type: "doc",
          content: [{ type: "paragraph" }],
        }),
    ).toThrow("Storage is read-only.")

    prepareWorksheetMode(WorksheetMode.EditingContent, WorksheetMode.Answering, first)
    const answering = createWorksheet(WorksheetMode.Answering, second)
    const oldContent = answering.content.document.snapshot()
    expect(() => answering.content.document.root.remove(0)).toThrow("Storage is read-only.")
    first.content.document.root.remove(0)
    expect(answering.content.document.snapshot()).not.toEqual(oldContent)
    expect(answering.content.document.root.length).toBe(initialContent.length - 1)

    const exerciseId = first.content.document.root.children()[0]?.id
    if (!exerciseId) throw new Error("Missing exercise")
    first.answers.document.root.set(
      exerciseId,
      FillInTheGapExercise.answer.createSnapshot({ values: { "capital-france": "Paris" } }),
    )
    prepareWorksheetMode(WorksheetMode.Answering, WorksheetMode.GivingFeedback, first)
    const feedback = createWorksheet(WorksheetMode.GivingFeedback, second)
    expect(
      feedback.feedback.document.root
        .field("exercises")
        .get(exerciseId)
        ?.field("automaticResult")
        .get(),
    ).toBe("correct")
    expect(() => feedback.answers.document.root.remove(exerciseId)).toThrow("Storage is read-only.")
    const feedbackEntry = feedback.feedback.document.root.field("exercises").get(exerciseId)
    feedbackEntry?.field("result").set("partial")
    prepareWorksheetMode(WorksheetMode.GivingFeedback, WorksheetMode.GivingFeedback, first)
    expect(
      first.feedback.document.root.field("exercises").get(exerciseId)?.field("result").get(),
    ).toBe("partial")
    const viewing = createWorksheet(WorksheetMode.ViewingFeedback, first)
    expect(() =>
      viewing.feedback.document.root
        .field("exercises")
        .get(exerciseId)
        ?.field("result")
        .set("correct"),
    ).toThrow("Storage is read-only.")
    prepareWorksheetMode(WorksheetMode.GivingFeedback, WorksheetMode.Answering, first)
    expect(feedback.feedback.document.root.field("exercises").get(exerciseId)).toBeUndefined()
    expect(first.answers.document.root.get(exerciseId)).toBeDefined()
    prepareWorksheetMode(WorksheetMode.Answering, WorksheetMode.EditingContent, first)
    expect(first.answers.document.root.get(exerciseId)).toBeUndefined()
  } finally {
    sessions.destroy()
  }
})
