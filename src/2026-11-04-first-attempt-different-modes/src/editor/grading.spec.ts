import { expect, test } from "bun:test"

import { initialContent } from "../demo/initial-content"
import { Root } from "./content"
import { bindDocument } from "./documents"
import { setChoiceAnswer, setExerciseFeedback, setGapAnswer } from "./responses"
import { FlatNodeStore } from "./storage"
import { createModeDocuments, createStudent, WorksheetMode } from "./worksheet"

test("automatic grading rejects missing/wrong answers and requires every choice to match", () => {
  const { gap, choice, student, grade } = fixture()
  const answers = student.answers.document.root
  expect(grade()).toEqual({ gap: "incorrect", choice: "incorrect" })
  setGapAnswer(answers, gap.id, "capital-france", "  pArIs  ")
  setChoiceAnswer(answers, choice.id, "four", true)
  expect(grade()).toEqual({ gap: "correct", choice: "correct" })
  setGapAnswer(answers, gap.id, "capital-france", "Lyon")
  setChoiceAnswer(answers, choice.id, "three", true)
  expect(grade()).toEqual({ gap: "incorrect", choice: "incorrect" })
  setChoiceAnswer(answers, choice.id, "four", false)
  expect(grade().choice).toBe("incorrect")
  setChoiceAnswer(answers, choice.id, "three", false)
  expect(grade().choice).toBe("incorrect")
  // Multiple correct options: selecting only one is not sufficient.
  choice.field("options").children()[0]!.field("isCorrect").set(true)
  setChoiceAnswer(answers, choice.id, "four", true)
  expect(grade().choice).toBe("incorrect")
  setChoiceAnswer(answers, choice.id, "three", true)
  expect(grade().choice).toBe("correct")
})

test("gap grading combines text split by marks, normalizes whitespace, and checks every gap", () => {
  const { gap, student, grade } = fixture()
  gap
    .field("content")
    .getEditor()
    .setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "New ", marks: [{ type: "gap", attrs: { id: "city" } }] },
            {
              type: "text",
              text: "York",
              marks: [{ type: "gap", attrs: { id: "city" } }, { type: "bold" }],
            },
            { type: "text", text: " and " },
            { type: "text", text: "Paris", marks: [{ type: "gap", attrs: { id: "capital" } }] },
          ],
        },
      ],
    })
  const answers = student.answers.document.root
  setGapAnswer(answers, gap.id, "city", "new   york")
  expect(grade().gap).toBe("incorrect")
  setGapAnswer(answers, gap.id, "capital", "Paris")
  expect(grade().gap).toBe("correct")
  setGapAnswer(answers, gap.id, "capital", "  ")
  expect(grade().gap).toBe("incorrect")
})

test("feedback re-entry refreshes automatic grades while preserving rich comments and overrides", () => {
  const { gap, student, grade } = fixture()
  grade()
  const feedback = student.feedback.document.root
  setExerciseFeedback(feedback, gap.id, "gap-feedback", "result", "partial")
  const entry = feedback.field("exercises").get(gap.id)!
  const comment = entry.field("comment")
  comment.getEditor().setContent({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hinweis", marks: [{ type: "italic" }] }],
      },
    ],
  })
  const snapshot = comment.snapshot()
  setGapAnswer(student.answers.document.root, gap.id, "capital-france", "Paris")
  expect(grade().gap).toBe("correct")
  const rebound = feedback.field("exercises").get(gap.id)!
  expect(rebound.id).toBe(entry.id)
  expect(rebound.field("comment").id).toBe(comment.id)
  expect(rebound.field("comment").snapshot()).toEqual(snapshot)
  expect(rebound.field("result").get()).toBe("partial")
  const viewing = createModeDocuments(
    WorksheetMode.ViewingFeedback,
    bindDocument(new FlatNodeStore(), Root, []),
    student,
  )
  expect(() =>
    viewing
      .feedback!.document.root.field("exercises")
      .get(gap.id)!
      .field("comment")
      .getEditor()
      .setContent({ type: "doc" }),
  ).toThrow("Storage is read-only.")
})

test("empty exercises are unassessed rather than vacuously correct", () => {
  const { gap, choice, grade } = fixture()
  gap
    .field("content")
    .getEditor()
    .setContent({ type: "doc", content: [{ type: "paragraph" }] })
  while (choice.field("options").length) choice.field("options").remove(0)
  expect(grade()).toEqual({ gap: "unassessed", choice: "unassessed" })
})

function fixture() {
  const content = bindDocument(new FlatNodeStore(), Root, initialContent)
  const student = createStudent("student", "Student")
  const gap = content.document.root.children().find((value) => value.type === "fill-in-the-blank")!
  const choice = content.document.root.children().find((value) => value.type === "multiple-choice")!
  return {
    gap,
    choice,
    student,
    grade() {
      createModeDocuments(WorksheetMode.GivingFeedback, content, student)
      const entries = student.feedback.document.root.field("exercises")
      return {
        gap: entries.get(gap.id)!.field("automaticResult").get(),
        choice: entries.get(choice.id)!.field("automaticResult").get(),
      }
    },
  }
}
