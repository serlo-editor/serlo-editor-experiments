import { expect, test } from "bun:test"

import { initialContent } from "../demo/initial-content"
import { createDemoSessions } from "../demo/sessions"
import { feedbackText, setChoiceAnswer, setExerciseFeedback, setGapAnswer } from "./responses"
import { YjsNodeStore } from "./storage"
import { createModeDocuments, createStudent } from "./worksheet"

test("Yjs peers synchronize all three documents and keep read-only modes live", () => {
  const sessions = createDemoSessions(initialContent)
  try {
    const first = createModeDocuments("answering", sessions.first, sessions.student)
    const second = createModeDocuments("answering", sessions.second, sessions.secondStudent)
    const viewing = createModeDocuments("viewing", sessions.second, sessions.secondStudent)
    const stores = [
      sessions.first.store,
      sessions.second.store,
      sessions.student.answers.store,
      sessions.secondStudent.answers.store,
      sessions.student.feedback.store,
      sessions.secondStudent.feedback.store,
    ]
    expect(new Set(stores).size).toBe(6)
    expect(stores.every((store) => store instanceof YjsNodeStore)).toBe(true)
    const gap = sessions.first.document.root
      .children()
      .find((value) => value.type === "fill-in-the-blank")!
    const choice = sessions.first.document.root
      .children()
      .find((value) => value.type === "multiple-choice")!
    const contentRevision = sessions.first.store.getRevision()
    let answerUpdates = 0
    const unsubscribe = viewing.answers!.store.subscribe(() => answerUpdates++)
    setGapAnswer(first.answers!.document.root, gap.id, "capital-france", "Paris")
    expect(second.answers!.document.snapshot()).toEqual(first.answers!.document.snapshot())
    expect(viewing.answers!.document.snapshot()).toEqual(first.answers!.document.snapshot())
    setChoiceAnswer(second.answers!.document.root, choice.id, "four", true)
    expect(first.answers!.document.snapshot()).toEqual(second.answers!.document.snapshot())
    expect(viewing.answers!.document.snapshot()).toEqual(first.answers!.document.snapshot())
    expect(answerUpdates).toBeGreaterThan(0)
    unsubscribe()
    expect(sessions.first.store.getRevision()).toBe(contentRevision)
    const answersRevision = sessions.student.answers.store.getRevision()
    const reviewing = createModeDocuments("feedback", sessions.first, sessions.student)
    const feedback = reviewing.feedback!
    const initialized = feedback.document.snapshot()
    createModeDocuments("feedback", sessions.second, sessions.secondStudent)
    expect(feedback.document.snapshot()).toEqual(initialized)
    const previousView = viewing.feedback!.document
    setExerciseFeedback(feedback.document.root, gap.id, "gap-feedback", "result", "partial")
    setExerciseFeedback(feedback.document.root, gap.id, "gap-feedback", "comment", "Gut gemacht!")
    feedback.document.root.field("overall").getEditor().setContent(feedbackText("Weiter so."))
    expect(viewing.feedback!.document).not.toBe(previousView)
    expect(viewing.feedback!.document).toBe(viewing.feedback!.document)
    expect(sessions.secondStudent.feedback.document.snapshot()).toEqual(
      feedback.document.snapshot(),
    )
    expect(viewing.feedback!.document.snapshot()).toEqual(feedback.document.snapshot())
    expect(first.feedback!.document.snapshot()).toEqual(feedback.document.snapshot())
    expect(viewing.feedback!.document.root.field("overall").snapshot()).toEqual(
      feedbackText("Weiter so."),
    )
    expect(
      viewing.feedback!.document.root.field("exercises").get(gap.id)!.field("comment").snapshot(),
    ).toEqual(feedbackText("Gut gemacht!"))
    expect(sessions.student.answers.store.getRevision()).toBe(answersRevision)
    const readonlyRevision = viewing.feedback!.store.getRevision()
    expect(() =>
      viewing
        .feedback!.document.root.field("overall")
        .getEditor()
        .setContent(feedbackText("Forbidden")),
    ).toThrow("Storage is read-only.")
    expect(() => setChoiceAnswer(viewing.answers!.document.root, choice.id, "four", false)).toThrow(
      "Storage is read-only.",
    )
    expect(viewing.feedback!.store.getRevision()).toBe(readonlyRevision)
    const option = sessions.second.document.root
      .children()
      .find((value) => value.type === "multiple-choice")!
      .field("options")
      .children()[0]!
    option.field("isCorrect").set(true)
    expect(first.content.document.snapshot()).toEqual(sessions.second.document.snapshot())
    expect(viewing.content.document.snapshot()).toEqual(sessions.second.document.snapshot())
    expect(() => viewing.content.document.root.remove(0)).toThrow("Storage is read-only.")
  } finally {
    sessions.destroy()
    sessions.destroy()
  }
})

// Exercise the real session/store composition, not only disabled UI controls.
test("mode transitions isolate writes, preserve identities, and keep student documents separate", () => {
  const sessions = createDemoSessions(initialContent)
  try {
    const alice = sessions.student
    const bob = createStudent("other-student", "Other student")
    const source = sessions.first
    const choice = source.document.root
      .children()
      .find((value) => value.type === "multiple-choice")!
    const gap = source.document.root.children().find((value) => value.type === "fill-in-the-blank")!
    const option = choice.field("options").children()[0]!
    option.field("isCorrect").set(true)
    expect(sessions.second.document.snapshot()).toEqual(source.document.snapshot())
    const original = source.document.snapshot()
    const revision = source.store.getRevision()

    const answering = createModeDocuments("answering", source, alice)
    expect(answering.content.document.snapshot()).toEqual(original)
    expect(() => answering.content.document.root.remove(0)).toThrow("Storage is read-only.")
    const readonlyChoice = answering.content.document.root
      .children()
      .find((value) => value.type === "multiple-choice")!
    expect(() =>
      readonlyChoice.field("options").children()[0]!.field("isCorrect").set(false),
    ).toThrow("Storage is read-only.")
    expect(() => readonlyChoice.field("question").getEditor().setContent({ type: "doc" })).toThrow(
      "Storage is read-only.",
    )
    expect(() =>
      answering
        .feedback!.document.root.field("overall")
        .getEditor()
        .setContent(feedbackText("Not allowed")),
    ).toThrow("Storage is read-only.")

    setGapAnswer(answering.answers!.document.root, gap.id, "capital-france", "Paris")
    setChoiceAnswer(answering.answers!.document.root, choice.id, "four", true)
    const answerId = alice.answers.document.root.get(choice.id)!.id
    setChoiceAnswer(answering.answers!.document.root, choice.id, "three", false)
    expect(alice.answers.document.root.get(choice.id)!.id).toBe(answerId)
    const answers = alice.answers.document.snapshot()
    expect(source.document.snapshot()).toEqual(original)
    expect(source.store.getRevision()).toBe(revision)
    expect(bob.answers.document.snapshot()).toEqual({})

    const reviewing = createModeDocuments("feedback", source, alice)
    expect(reviewing.answers!.document.snapshot()).toEqual(answers)
    expect(() => reviewing.answers!.document.root.remove(choice.id)).toThrow(
      "Storage is read-only.",
    )
    expect(() =>
      setChoiceAnswer(reviewing.answers!.document.root, choice.id, "four", false),
    ).toThrow("Storage is read-only.")
    expect(() => reviewing.content.document.root.remove(0)).toThrow("Storage is read-only.")
    setExerciseFeedback(
      reviewing.feedback!.document.root,
      choice.id,
      "choice-feedback",
      "result",
      "correct",
    )
    setExerciseFeedback(
      reviewing.feedback!.document.root,
      choice.id,
      "choice-feedback",
      "comment",
      "Gut gemacht!",
    )
    reviewing
      .feedback!.document.root.field("overall")
      .getEditor()
      .setContent(feedbackText("Weiter so."))
    const feedback = alice.feedback.document.snapshot()
    expect(alice.answers.document.snapshot()).toEqual(answers)
    expect(source.document.snapshot()).toEqual(original)
    expect(bob.feedback.document.snapshot()).toEqual({ overall: feedbackText(), exercises: {} })

    const viewing = createModeDocuments("viewing", source, alice)
    expect(viewing.answers!.document.snapshot()).toEqual(answers)
    expect(viewing.feedback!.document.snapshot()).toEqual(feedback)
    expect(() => viewing.content.document.root.remove(0)).toThrow("Storage is read-only.")
    expect(() => viewing.answers!.document.root.remove(choice.id)).toThrow("Storage is read-only.")
    expect(() =>
      viewing
        .feedback!.document.root.field("overall")
        .getEditor()
        .setContent(feedbackText("Changed")),
    ).toThrow("Storage is read-only.")
    expect(createModeDocuments("answering", source, alice).answers!.document.snapshot()).toEqual(
      answers,
    )
    expect(createModeDocuments("feedback", source, alice).feedback!.document.snapshot()).toEqual(
      feedback,
    )
    expect(createModeDocuments("authoring", source, alice).answers).toBeUndefined()
  } finally {
    sessions.destroy()
  }
})

test("response joins survive read-only rebinding and sibling insertions; mismatched variants reject writes", () => {
  const sessions = createDemoSessions(initialContent)
  try {
    const student = sessions.student
    const source = sessions.first
    const choice = source.document.root
      .children()
      .find((value) => value.type === "multiple-choice")!
    setChoiceAnswer(student.answers.document.root, choice.id, "four", true)
    const answers = student.answers.document.snapshot()
    const original = choice.snapshot()
    source.document.root.remove(0)
    const options = choice.field("options")
    options.insert(0, {
      optionId: "new-option",
      isCorrect: false,
      text: { type: "doc", content: [{ type: "inlineBlock" }] },
    })
    const rebound = createModeDocuments("answering", source, student)
    const reboundChoice = rebound.content.document.root
      .children()
      .find((value) => value.type === "multiple-choice")!
    expect(reboundChoice.id).toBe(original.id)
    expect(reboundChoice.field("options").children()[1]!.field("optionId").get()).toBe(
      original.options[0]!.optionId,
    )
    expect(student.answers.document.snapshot()).toEqual(answers)
    expect(() =>
      setGapAnswer(student.answers.document.root, choice.id, "gap", "Wrong variant"),
    ).toThrow("Incompatible answer type.")
    expect(student.answers.document.snapshot()).toEqual(answers)
    setExerciseFeedback(
      student.feedback.document.root,
      choice.id,
      "choice-feedback",
      "comment",
      "Comment",
    )
    expect(() =>
      setExerciseFeedback(
        student.feedback.document.root,
        choice.id,
        "gap-feedback",
        "comment",
        "Wrong variant",
      ),
    ).toThrow("Incompatible feedback type.")
  } finally {
    sessions.destroy()
  }
})
