import { expect, test } from "bun:test"

import { initialContent } from "../demo/initial-content"
import { createDemoSessions } from "../demo/sessions"
import { feedbackText, setChoiceAnswer, setExerciseFeedback, setGapAnswer } from "./responses"
import { YjsNodeStore } from "./storage"
import { createFlatResponses } from "./test-responses"
import { clearFollowingDocuments, createModeDocuments, WorksheetMode } from "./worksheet"

test("mode switches clear only downstream documents across Yjs peers and Flat storage", () => {
  const sessions = createDemoSessions(initialContent)
  try {
    const content = sessions.first.document.snapshot()
    const contentRevision = sessions.first.store.getRevision()
    const choice = sessions.first.document.root
      .children()
      .find((value) => value.type === "multiple-choice")!
    const emptyFeedback = { overall: feedbackText(), exercises: {} }
    const otherResponses = createFlatResponses()
    setChoiceAnswer(otherResponses.answers.document.root, choice.id, "three", true)
    const otherAnswers = otherResponses.answers.document.snapshot()

    for (const responses of [sessions.responses, createFlatResponses()]) {
      const viewing = createModeDocuments(WorksheetMode.ViewingFeedback, sessions.second, responses)
      setChoiceAnswer(responses.answers.document.root, choice.id, "four", true)
      createModeDocuments(WorksheetMode.GivingFeedback, sessions.first, responses)
      setExerciseFeedback(
        responses.feedback.document.root,
        choice.id,
        "choice-feedback",
        "result",
        "partial",
      )
      setExerciseFeedback(
        responses.feedback.document.root,
        choice.id,
        "choice-feedback",
        "comment",
        "Old comment",
      )
      responses.feedback.document.root
        .field("overall")
        .getEditor()
        .setContent(feedbackText("Old overall"))
      const answers = responses.answers.document.snapshot()
      const feedback = responses.feedback.document.snapshot()

      clearFollowingDocuments(WorksheetMode.ViewingFeedback, responses)
      clearFollowingDocuments(WorksheetMode.GivingFeedback, responses)
      expect(responses.answers.document.snapshot()).toEqual(answers)
      expect(responses.feedback.document.snapshot()).toEqual(feedback)

      clearFollowingDocuments(WorksheetMode.Answering, responses)
      expect(responses.answers.document.snapshot()).toEqual(answers)
      expect(responses.feedback.document.snapshot()).toEqual(emptyFeedback)
      expect(viewing.feedback!.document.snapshot()).toEqual(emptyFeedback)
      if (responses === sessions.responses) {
        expect(sessions.secondResponses.answers.document.snapshot()).toEqual(answers)
        expect(sessions.secondResponses.feedback.document.snapshot()).toEqual(emptyFeedback)
      }

      const reviewing = createModeDocuments(WorksheetMode.GivingFeedback, sessions.first, responses)
      const exercise = reviewing.feedback!.document.root.field("exercises").get(choice.id)!
      expect(exercise.field("result").get()).toBe("automatic")
      expect(exercise.field("automaticResult").get()).toBe("correct")
      expect(exercise.field("comment").snapshot()).toEqual(feedbackText())
      expect(reviewing.feedback!.document.root.field("overall").snapshot()).toEqual(feedbackText())

      // Reset through the other replica too; no new stores or content documents needed.
      clearFollowingDocuments(
        WorksheetMode.EditingContent,
        responses === sessions.responses ? sessions.secondResponses : responses,
      )
      expect(responses.answers.document.snapshot()).toEqual({})
      expect(responses.feedback.document.snapshot()).toEqual(emptyFeedback)
      expect(viewing.answers!.document.snapshot()).toEqual({})
      expect(viewing.feedback!.document.snapshot()).toEqual(emptyFeedback)
      const regraded = createModeDocuments(WorksheetMode.GivingFeedback, sessions.first, responses)
      expect(
        regraded
          .feedback!.document.root.field("exercises")
          .get(choice.id)!
          .field("automaticResult")
          .get(),
      ).toBe("incorrect")
    }
    expect(otherResponses.answers.document.snapshot()).toEqual(otherAnswers)
    expect(sessions.first.document.snapshot()).toEqual(content)
    expect(sessions.second.document.snapshot()).toEqual(content)
    expect(sessions.first.store.getRevision()).toBe(contentRevision)
  } finally {
    sessions.destroy()
  }
})

test("Yjs peers synchronize all three documents and keep read-only modes live", () => {
  const sessions = createDemoSessions(initialContent)
  try {
    const first = createModeDocuments(WorksheetMode.Answering, sessions.first, sessions.responses)
    const second = createModeDocuments(
      WorksheetMode.Answering,
      sessions.second,
      sessions.secondResponses,
    )
    const viewing = createModeDocuments(
      WorksheetMode.ViewingFeedback,
      sessions.second,
      sessions.secondResponses,
    )
    const stores = [
      sessions.first.store,
      sessions.second.store,
      sessions.responses.answers.store,
      sessions.secondResponses.answers.store,
      sessions.responses.feedback.store,
      sessions.secondResponses.feedback.store,
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
    const answersRevision = sessions.responses.answers.store.getRevision()
    const reviewing = createModeDocuments(
      WorksheetMode.GivingFeedback,
      sessions.first,
      sessions.responses,
    )
    const feedback = reviewing.feedback!
    const initialized = feedback.document.snapshot()
    createModeDocuments(WorksheetMode.GivingFeedback, sessions.second, sessions.secondResponses)
    expect(feedback.document.snapshot()).toEqual(initialized)
    const previousView = viewing.feedback!.document
    setExerciseFeedback(feedback.document.root, gap.id, "gap-feedback", "result", "partial")
    setExerciseFeedback(feedback.document.root, gap.id, "gap-feedback", "comment", "Gut gemacht!")
    feedback.document.root.field("overall").getEditor().setContent(feedbackText("Weiter so."))
    expect(viewing.feedback!.document).not.toBe(previousView)
    expect(viewing.feedback!.document).toBe(viewing.feedback!.document)
    expect(sessions.secondResponses.feedback.document.snapshot()).toEqual(
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
    expect(sessions.responses.answers.store.getRevision()).toBe(answersRevision)
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
test("mode bindings isolate writes, preserve identities, and keep student documents separate", () => {
  const sessions = createDemoSessions(initialContent)
  try {
    const aliceResponses = sessions.responses
    const bobResponses = createFlatResponses()
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

    const answering = createModeDocuments(WorksheetMode.Answering, source, aliceResponses)
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
    const answerId = aliceResponses.answers.document.root.get(choice.id)!.id
    setChoiceAnswer(answering.answers!.document.root, choice.id, "three", false)
    expect(aliceResponses.answers.document.root.get(choice.id)!.id).toBe(answerId)
    const answers = aliceResponses.answers.document.snapshot()
    expect(source.document.snapshot()).toEqual(original)
    expect(source.store.getRevision()).toBe(revision)
    expect(bobResponses.answers.document.snapshot()).toEqual({})

    const reviewing = createModeDocuments(WorksheetMode.GivingFeedback, source, aliceResponses)
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
    const feedback = aliceResponses.feedback.document.snapshot()
    expect(aliceResponses.answers.document.snapshot()).toEqual(answers)
    expect(source.document.snapshot()).toEqual(original)
    expect(bobResponses.feedback.document.snapshot()).toEqual({
      overall: feedbackText(),
      exercises: {},
    })

    const viewing = createModeDocuments(WorksheetMode.ViewingFeedback, source, aliceResponses)
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
    expect(
      createModeDocuments(
        WorksheetMode.Answering,
        source,
        aliceResponses,
      ).answers!.document.snapshot(),
    ).toEqual(answers)
    expect(
      createModeDocuments(
        WorksheetMode.GivingFeedback,
        source,
        aliceResponses,
      ).feedback!.document.snapshot(),
    ).toEqual(feedback)
    expect(
      createModeDocuments(WorksheetMode.EditingContent, source, aliceResponses).answers,
    ).toBeUndefined()
  } finally {
    sessions.destroy()
  }
})

test("response joins survive read-only rebinding and sibling insertions; mismatched variants reject writes", () => {
  const sessions = createDemoSessions(initialContent)
  try {
    const responses = sessions.responses
    const source = sessions.first
    const choice = source.document.root
      .children()
      .find((value) => value.type === "multiple-choice")!
    setChoiceAnswer(responses.answers.document.root, choice.id, "four", true)
    const answers = responses.answers.document.snapshot()
    const original = choice.snapshot()
    source.document.root.remove(0)
    const options = choice.field("options")
    options.insert(0, {
      optionId: "new-option",
      isCorrect: false,
      text: { type: "doc", content: [{ type: "inlineBlock" }] },
    })
    const rebound = createModeDocuments(WorksheetMode.Answering, source, responses)
    const reboundChoice = rebound.content.document.root
      .children()
      .find((value) => value.type === "multiple-choice")!
    expect(reboundChoice.id).toBe(original.id)
    expect(reboundChoice.field("options").children()[1]!.field("optionId").get()).toBe(
      original.options[0]!.optionId,
    )
    expect(responses.answers.document.snapshot()).toEqual(answers)
    expect(() =>
      setGapAnswer(responses.answers.document.root, choice.id, "gap", "Wrong variant"),
    ).toThrow("Incompatible answer type.")
    expect(responses.answers.document.snapshot()).toEqual(answers)
    setExerciseFeedback(
      responses.feedback.document.root,
      choice.id,
      "choice-feedback",
      "comment",
      "Comment",
    )
    expect(() =>
      setExerciseFeedback(
        responses.feedback.document.root,
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
