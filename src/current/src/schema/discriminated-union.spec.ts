import { expect, test } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { YjsNodeStore } from "../storage/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import {
  array,
  boolean,
  discriminatedUnion,
  object,
  record,
  string,
  taggedObject,
  block,
} from "./index.ts"
import { openRoot } from "./root.ts"
import type { StoredValueOf } from "./types.ts"

function definitions() {
  const choice = block({
    type: "choice",
    fields: {
      question: string(),
      answers: array(object({ text: string(), correct: boolean() })),
      explanation: string(),
    },
    render({ value }) {
      return value.question.get() satisfies string
    },
  })
  const forensic = block({
    type: "forensic",
    fields: { caseId: string() },
    render: ({ value }) => value.caseId.get(),
  })
  return { choice, forensic, exercise: discriminatedUnion([choice, forensic]) }
}

function choiceFields(question = "Which answer?") {
  return { question, answers: [{ text: "First", correct: true }], explanation: "Because" }
}

describeWithStores("discriminated unions", (getStore) => {
  test("narrow stored values in object fields", () => {
    const store = getStore()
    const { choice, exercise } = definitions()
    const initial = choice.createSnapshot(choiceFields())
    const note = choice.createSnapshot(choiceFields("Note"))
    const schema = object({ exercise, note: exercise })
    const root = openRoot(store, schema, { exercise: initial, note })
    const required = root.exercise
    expect(required.definition).toBe(choice)
    if (required.type === "choice") {
      expect(required.question.get() satisfies string).toBe("Which answer?")
      // @ts-expect-error Narrowed choice values have no forensic fields.
      expect(required.caseId).toBeUndefined()
    } else {
      throw new Error("Expected choice.")
    }
    const current = root.note
    expect(current.id).toBe(note.id)
    expect(current.definition).toBe(choice)
    const typed: StoredValueOf<typeof exercise> = current
    expect(typed.snapshot()).toEqual(note)
    expect(root.exercise.id).toBe(initial.id)
  })

  test("combines tagged objects and blocks without renderer metadata on responses", () => {
    const { choice } = definitions()
    const response = taggedObject({ type: "response", fields: { text: string() } })
    const schema = record(discriminatedUnion([choice, response]))
    const root = openRoot(getStore(), schema, { answer: { type: "response", text: "Yes" } })
    const value = root.get("answer")!
    if (value.type !== "response") throw new Error("Expected response.")
    expect(value.text.get() satisfies string).toBe("Yes")
    expect(value.snapshot()).toEqual({ type: "response", text: "Yes" })
    root.set("answer", choice.createSnapshot(choiceFields()))
    expect(root.get("answer")?.type).toBe("choice")
  })

  test("sibling insertions and removals preserve unchanged IDs", () => {
    const { choice, forensic, exercise } = definitions()
    const kept = choice.createSnapshot(choiceFields("Kept"))
    const inserted = forensic.createSnapshot({ caseId: "inserted" })
    const root = openRoot(getStore(), array(exercise), [kept])
    root.insert(0, inserted)
    expect(root.length).toBe(2)
    expect(root.children()[1]!.id).toBe(kept.id)
    expect(root.snapshot()).toEqual([inserted, kept])
    root.remove(0)
    expect(root.children()[0]!.id).toBe(kept.id)
    expect(root.snapshot()).toEqual([kept])
    // @ts-expect-error Array stored values expose insert/remove, not replacement.
    expect(root.replace).toBeUndefined()
  })

  test("rejects empty and ambiguous child definitions", () => {
    const { choice } = definitions()
    expect(() => discriminatedUnion([])).toThrow("Expected at least one typed definition.")
    expect(() => discriminatedUnion([choice, choice])).toThrow("Duplicate type: choice.")
  })

  test("rejects invalid block metadata and missing fields during insertion", () => {
    const { choice, exercise } = definitions()
    const initial = choice.createSnapshot(choiceFields())
    const root = openRoot(getStore(), array(exercise), [initial])
    expect(root.snapshot()).toEqual([initial])
    expect(() => choice.create(getStore(), { ...initial, type: "choice", id: "" })).toThrow(
      "Expected block ID.",
    )
    expect(() => {
      // @ts-expect-error A concrete block schema rejects other type discriminators.
      choice.create(getStore(), { ...initial, type: "forensic" })
    }).toThrow("Expected block type: choice.")
  })
})

test("Yjs replicas bind matching IDs to local definitions and retain sibling identities", () => {
  const firstDoc = new Y.Doc()
  const secondDoc = new Y.Doc()
  const firstStore = new YjsNodeStore({ doc: firstDoc, awareness: new Awareness(firstDoc) })
  const secondStore = new YjsNodeStore({ doc: secondDoc, awareness: new Awareness(secondDoc) })
  const local = definitions()
  const remote = definitions()
  try {
    const kept = local.choice.createSnapshot(choiceFields())
    const first = openRoot(firstStore, array(local.exercise), [kept])
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = openRoot(secondStore, array(remote.exercise), [])
    expect(second.children()[0]!.id).toBe(kept.id)
    expect(second.children()[0]!.definition).toBe(remote.choice)
    expect(second.children()[0]!.definition).not.toBe(local.choice)

    first.insert(0, local.forensic.createSnapshot({ caseId: "new" }))
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    expect(second.children()[1]!.id).toBe(kept.id)
    second.remove(0)
    Y.applyUpdate(firstDoc, Y.encodeStateAsUpdate(secondDoc))
    expect(first.children()[0]!.id).toBe(kept.id)
    expect(first.snapshot()).toEqual(second.snapshot())
  } finally {
    firstDoc.destroy()
    secondDoc.destroy()
  }
})
