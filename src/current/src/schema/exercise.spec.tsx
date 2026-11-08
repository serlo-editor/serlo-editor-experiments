import { expect, test } from "bun:test"

import { Window } from "happy-dom"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { WorksheetContext } from "../worksheet-context.ts"
import { openWorksheet, WorksheetMode, type Worksheet } from "../worksheet.ts"
import { BlockView } from "./block-view.ts"
import { discriminatedUnion } from "./discriminated-union.ts"
import { exercise } from "./exercise.tsx"
import { string } from "./primitives.ts"
import { record } from "./record.ts"
import { taggedObject } from "./tagged-object.ts"
import type { SnapshotOf, StoredValueOf } from "./types.ts"

describeWithStores("exercise renderer", (getStore) => {
  const schema = exercise({
    unit: { type: "question", fields: { question: string() } },
    answer: { fields: { response: string() } },
    feedback: { fields: { comment: string() } },
    grade: (_unit, answer) =>
      answer.response.get() === "42" ? { type: "question", comment: "Correct" } : undefined,
    render: ({ unit, answer, feedback, mode }) => (
      <p>{`${unit.question.get()} / ${answer?.response.get() ?? ""} / ${feedback?.comment.get() ?? ""} / ${mode} / ${unit.id}`}</p>
    ),
  })
  const otherAnswer = taggedObject({ type: "other", fields: { response: string() } })
  const otherFeedback = taggedObject({ type: "other", fields: { comment: string() } })
  const answersSchema = record(discriminatedUnion([schema.answer, otherAnswer]))
  const feedbackSchema = record(discriminatedUnion([schema.feedback, otherFeedback]))

  type ExerciseWorksheet = Worksheet<
    StoredValueOf<typeof schema>,
    StoredValueOf<typeof answersSchema>,
    StoredValueOf<typeof feedbackSchema>
  >
  type ExerciseOptions = {
    mode?: WorksheetMode
    answers?: Record<string, SnapshotOf<typeof schema.answer> | SnapshotOf<typeof otherAnswer>>
    feedback?: Record<string, SnapshotOf<typeof schema.feedback> | SnapshotOf<typeof otherFeedback>>
  }

  function openExercise({
    mode = WorksheetMode.ViewingFeedback,
    answers = {},
    feedback = {},
  }: ExerciseOptions = {}): ExerciseWorksheet {
    const unit = { ...schema.createSnapshot({ question: "What?" }), id: "task" }
    return openWorksheet({
      mode,
      store: getStore(),
      contentSchema: schema,
      answersSchema,
      feedbackSchema,
      initialSnapshot: { content: unit, answers, feedback },
    })
  }

  function view(worksheet: ExerciseWorksheet) {
    return (
      <WorksheetContext.Provider value={worksheet}>
        <BlockView value={worksheet.content} />
      </WorksheetContext.Provider>
    )
  }

  function renderExercise(options: ExerciseOptions = {}) {
    return renderToStaticMarkup(view(openExercise(options)))
  }

  async function mountExercise(
    worksheet: ExerciseWorksheet,
    assert: (host: HTMLElement, rerender: () => void) => void,
  ) {
    const window = new Window()
    const globals = new Map<string, PropertyDescriptor | undefined>()
    for (const key of ["window", "document", "navigator", "Node", "HTMLElement"]) {
      globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: Reflect.get(window, key),
      })
    }
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    try {
      const rerender = () => flushSync(() => root.render(view(worksheet)))
      rerender()
      assert(host, rerender)
    } finally {
      flushSync(() => root.unmount())
      await window.happyDOM.close()
      for (const [key, descriptor] of globals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    }
  }

  test("editing content hides stored answer and feedback", () => {
    expect(
      renderExercise({
        mode: WorksheetMode.EditingContent,
        answers: { task: { type: "question", response: "42" } },
        feedback: { task: { type: "question", comment: "Correct" } },
      }),
    ).toBe("<p>What? /  /  / editing-content / task</p>")
  })

  test("answering exposes an answer and hides feedback", () => {
    expect(
      renderExercise({
        mode: WorksheetMode.Answering,
        answers: { task: { type: "question", response: "42" } },
        feedback: { task: { type: "question", comment: "Correct" } },
      }),
    ).toBe("<p>What? / 42 /  / answering / task</p>")
  })

  test("missing answer is initialized in answering mode", async () => {
    const worksheet = openExercise({ mode: WorksheetMode.Answering })
    await mountExercise(worksheet, (host) => {
      expect(host.textContent).toBe("What? /  /  / answering / task")
      expect(worksheet.answers.get("task")?.snapshot()).toEqual({
        type: "question",
        response: "",
      })
      worksheet.answers.get("task")!.response.set("42")
      expect(worksheet.answers.get("task")?.response.get()).toBe("42")
      expect(worksheet.feedback.snapshot()).toEqual({})
    })
  })

  test("missing answer in either feedback mode throws", () => {
    for (const mode of [WorksheetMode.GivingFeedback, WorksheetMode.ViewingFeedback]) {
      expect(() => renderExercise({ mode })).toThrow("Antwort fehlt zur Aufgabe.")
    }
  })

  test("giving feedback initializes a graded result without replacing an existing one", async () => {
    const worksheet = openExercise({
      mode: WorksheetMode.GivingFeedback,
      answers: { task: { type: "question", response: "42" } },
    })
    await mountExercise(worksheet, (host, rerender) => {
      expect(host.textContent).toBe("What? / 42 / Correct / giving-feedback / task")
      expect(worksheet.feedback.get("task")?.snapshot()).toEqual({
        type: "question",
        comment: "Correct",
      })
      worksheet.feedback.get("task")!.comment.set("Reviewed")
      rerender()
      expect(host.textContent).toBe("What? / 42 / Reviewed / giving-feedback / task")
    })
  })

  test("giving feedback falls back to schema defaults when grading returns undefined", async () => {
    const worksheet = openExercise({
      mode: WorksheetMode.GivingFeedback,
      answers: { task: { type: "question", response: "Other" } },
    })
    await mountExercise(worksheet, (host) => {
      expect(host.textContent).toBe("What? / Other /  / giving-feedback / task")
      expect(worksheet.feedback.get("task")?.snapshot()).toEqual({
        type: "question",
        comment: "",
      })
    })
  })

  test("viewing feedback uses a read-only default without persisting it", () => {
    const worksheet = openExercise({
      answers: { task: { type: "question", response: "42" } },
    })
    expect(renderToStaticMarkup(view(worksheet))).toBe(
      "<p>What? / 42 /  / viewing-feedback / task</p>",
    )
    expect(worksheet.feedback.snapshot()).toEqual({})
  })

  test("renders matching stored answer and feedback", () => {
    expect(
      renderExercise({
        answers: { task: { type: "question", response: "42" } },
        feedback: { task: { type: "question", comment: "Correct" } },
      }),
    ).toBe("<p>What? / 42 / Correct / viewing-feedback / task</p>")
  })

  test("throws for answer with wrong type", () => {
    expect(() => renderExercise({ answers: { task: { type: "other", response: "42" } } })).toThrow(
      "Antwort passt nicht zur Aufgabe.",
    )
  })

  test("throws for feedback with wrong type", () => {
    expect(() =>
      renderExercise({
        answers: { task: { type: "question", response: "42" } },
        feedback: { task: { type: "other", comment: "Incorrect" } },
      }),
    ).toThrow("Feedback passt nicht zur Aufgabe.")
  })
})
