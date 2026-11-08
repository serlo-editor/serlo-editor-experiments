import { expect, test } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { YjsNodeStore } from "../storage/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { createDocument } from "./document.ts"
import { array, boolean, blockUnion, object, optional, string, block } from "./index.ts"
import type { StoredValueOf } from "./types.ts"

function definitions() {
  const choice = block({
    type: "choice",
    fields: {
      question: string(),
      answers: array(object({ text: string(), correct: boolean() })),
      explanation: optional(string()),
    },
    render({ value }) {
      return value.field("question").get() satisfies string
    },
  })
  const forensic = block({
    type: "forensic",
    fields: { caseId: string() },
    render: ({ value }) => value.field("caseId").get(),
  })
  return { choice, forensic, exercise: blockUnion([choice, forensic]) }
}

function choiceFields(question = "Which answer?") {
  return { question, answers: [{ text: "First", correct: true }] }
}

describeWithStores("block unions", (getStore) => {
  test("narrow stored values and support optional-field operations", () => {
    const store = getStore()
    const { choice, forensic, exercise } = definitions()
    const initial = choice.createSnapshot(choiceFields())
    const note = choice.createSnapshot(choiceFields("Note"))
    const schema = object({ exercise, note: optional(exercise) })
    const root = createDocument(store, schema, { exercise: initial, note })
    const required = root.field("exercise")
    expect(required.definition).toBe(choice)
    if (required.type === "choice") {
      expect(required.field("question").get() satisfies string).toBe("Which answer?")
      expect(() => {
        // @ts-expect-error Narrowed choice values have no forensic fields.
        required.field("caseId")
      }).toThrow("Unknown field: caseId.")
    } else {
      throw new Error("Expected choice.")
    }
    const oldNote = root.field("note")!
    const replacement = forensic.createSnapshot({ caseId: "case-42" })
    root.setOptional("note", replacement)
    const current = root.field("note")!
    expect(current.id).toBe(replacement.id)
    expect(current.id).not.toBe(oldNote.id)
    expect(oldNote.type).toBe("choice")
    expect(current.definition).toBe(forensic)
    if (current.type === "forensic") {
      expect(current.field("caseId").get() satisfies string).toBe("case-42")
    }
    expect(root.field("exercise").id).toBe(initial.id)

    const typed: StoredValueOf<typeof exercise> = current
    expect(typed.snapshot()).toEqual(replacement)
    const excluded = block({ type: "excluded", fields: {}, render: () => null })
    expect(() => {
      // @ts-expect-error Only explicitly allowed block types can occupy this child field.
      root.setOptional("note", excluded.createSnapshot({}))
    }).toThrow("Unknown child block type: excluded.")
    root.removeOptional("note")
    expect(root.field("note")).toBeUndefined()
  })

  test("sibling insertions and removals preserve unchanged IDs", () => {
    const { choice, forensic, exercise } = definitions()
    const kept = choice.createSnapshot(choiceFields("Kept"))
    const inserted = forensic.createSnapshot({ caseId: "inserted" })
    const root = createDocument(getStore(), array(exercise), [kept])
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
    expect(() => blockUnion([])).toThrow("Expected at least one child block definition.")
    expect(() => blockUnion([choice, choice])).toThrow("Duplicate block type: choice.")
  })

  test("rejects invalid block metadata and missing fields during insertion", () => {
    const { choice, exercise } = definitions()
    const initial = choice.createSnapshot(choiceFields())
    const root = createDocument(getStore(), array(exercise), [initial])
    for (const invalid of [
      null,
      [],
      {},
      { ...initial, id: "" },
      { ...initial, id: 3 },
      { ...initial, id: undefined },
      { ...initial, type: "unknown" },
      { ...initial, question: undefined },
      { ...initial, extra: true },
      { ...initial, answers: [{ text: "Answer" }] },
      { ...initial, answers: "wrong" },
    ]) {
      // JSON.parse models untyped imported data; failed imports may allocate unused content.
      expect(() => root.insert(1, JSON.parse(JSON.stringify(invalid)))).toThrow()
    }
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
    const first = createDocument(firstStore, array(local.exercise), [kept])
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = createDocument(secondStore, array(remote.exercise), [])
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
