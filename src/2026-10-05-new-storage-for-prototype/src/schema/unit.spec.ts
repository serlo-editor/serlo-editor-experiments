import { expect, test } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { richText as definition } from "../rich-text/index.ts"
import { YjsNodeStore } from "../storage/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { createDocument } from "./document.ts"
import {
  array,
  boolean,
  childUnit,
  createUnit,
  object,
  optional,
  richText,
  string,
  unit,
} from "./index.ts"
import type { HandleOf, SnapshotOf } from "./types.ts"

function definitions() {
  const choice = unit({
    type: "choice",
    fields: {
      question: string(),
      answers: array(object({ text: string(), correct: boolean() })),
      explanation: optional(string()),
    },
    render({ handle }) {
      return handle.field("question").get() satisfies string
    },
  })
  const forensic = unit({
    type: "forensic",
    fields: { caseId: string() },
    render: ({ handle }) => handle.field("caseId").get(),
  })
  return { choice, forensic, exercise: childUnit([choice, forensic]) }
}

function choiceFields(question = "Which answer?") {
  return { question, answers: [{ text: "First", correct: true }] }
}

describeWithStores("unit schemas", (getStore) => {
  test("creates flat snapshots with fresh IDs and typed object handles", () => {
    const { choice } = definitions()
    const fields = choiceFields()
    const initial = createUnit(choice, fields)
    const other = createUnit(choice, fields)
    expect(initial.id).not.toBe(other.id)
    expect(initial).toEqual({ id: expect.any(String), type: "choice", ...fields })
    fields.answers[0]!.text = "Caller changed"
    expect(initial.answers[0]!.text).toBe("First")

    const document = createDocument(getStore(), choice, initial)
    const handle = document.root
    expect(handle.id satisfies string).toBe(initial.id)
    expect(handle.type satisfies "choice").toBe("choice")
    expect(handle.definition).toBe(choice)
    expect(handle.snapshot()).toEqual(initial)
    expect(handle.field("question").get() satisfies string).toBe("Which answer?")
    expect(handle.field("explanation")).toBeUndefined()
    handle.field("question").set("Updated")
    handle.setOptional("explanation", "Because")
    expect(document.snapshot()).toEqual({ ...initial, question: "Updated", explanation: "Because" })
    expect(handle.id).toBe(initial.id)
    expect(Object.keys(document.snapshot()).sort()).toEqual([
      "answers",
      "explanation",
      "id",
      "question",
      "type",
    ])

    expect(() => {
      // @ts-expect-error Metadata is not an editable field.
      handle.set("id", "replacement")
    }).toThrow("Unknown field: id.")
    expect(() => {
      // @ts-expect-error Metadata is not an editable field.
      handle.set("type", "forensic")
    }).toThrow("Unknown field: type.")
    expect(() => {
      // @ts-expect-error Metadata is read through properties, not field handles.
      handle.field("id")
    }).toThrow("Unknown field: id.")

    // @ts-expect-error Snapshot retains literal discriminator.
    const wrongType: SnapshotOf<typeof choice> = { ...initial, type: "forensic" }
    void wrongType
  })

  test("loading and reopening preserve IDs instead of creating new units", () => {
    const store = getStore()
    const { choice } = definitions()
    const loaded = { ...createUnit(choice, choiceFields()), id: "previously-saved-id" }
    const first = createDocument(store, choice, loaded)
    const second = createDocument(store, choice, createUnit(choice, choiceFields("Ignored")))
    expect(first.root.id).toBe(loaded.id)
    expect(second.root.id).toBe(loaded.id)
    expect(second.snapshot()).toEqual(loaded)
  })

  test("child unions narrow handles and replace children through their parent", () => {
    const store = getStore()
    const { choice, forensic, exercise } = definitions()
    const initial = createUnit(choice, choiceFields())
    const schema = object({ exercise, items: array(exercise), note: optional(exercise) })
    const { root } = createDocument(store, schema, { exercise: initial, items: [] })
    const old = root.field("exercise")
    expect(old.definition).toBe(choice)
    if (old.type === "choice") {
      expect(old.field("question").get() satisfies string).toBe("Which answer?")
      expect(() => {
        // @ts-expect-error Narrowed choice handles have no forensic fields.
        old.field("caseId")
      }).toThrow("Unknown field: caseId.")
    } else {
      throw new Error("Expected choice.")
    }
    const replacement = createUnit(forensic, { caseId: "case-42" })
    let notifications = 0
    const unsubscribe = store.subscribe(() => notifications++)
    root.set("exercise", replacement)
    expect(notifications).toBe(1)
    unsubscribe()
    const current = root.field("exercise")
    expect(current.id).toBe(replacement.id)
    expect(current.id).not.toBe(old.id)
    expect(old.type).toBe("choice")
    expect(current.definition).toBe(forensic)
    if (current.type === "forensic") {
      expect(current.field("caseId").get() satisfies string).toBe("case-42")
    }
    root.setOptional("note", createUnit(choice, choiceFields("Note")))
    expect(root.field("note")!.type).toBe("choice")
    root.removeOptional("note")
    expect(root.field("note")).toBeUndefined()

    const typed: HandleOf<typeof exercise> = current
    expect(typed.snapshot()).toEqual(replacement)
    const excluded = unit({ type: "excluded", fields: {}, render: () => null })
    expect(() => {
      // @ts-expect-error Only explicitly allowed unit types can replace this child.
      root.set("exercise", createUnit(excluded, {}))
    }).toThrow("Unknown child unit type: excluded.")
  })

  test("sibling insertions, removals and atomic replacements preserve unchanged IDs", () => {
    const store = getStore()
    const { choice, forensic, exercise } = definitions()
    const kept = createUnit(choice, choiceFields("Kept"))
    const { root } = createDocument(store, array(exercise), [kept])
    root.insert(0, createUnit(choice, choiceFields("Inserted")))
    expect(root.children()[1]!.id).toBe(kept.id)
    const replacement = createUnit(forensic, { caseId: "replacement" })
    let notifications = 0
    const unsubscribe = store.subscribe(() => notifications++)
    root.replace(0, replacement)
    expect(notifications).toBe(1)
    unsubscribe()
    expect(root.length).toBe(2)
    expect(root.snapshot()).toEqual([replacement, kept])
    root.remove(0)
    expect(root.children()[0]!.id).toBe(kept.id)
    for (const index of [-1, 1, 0.5, NaN]) {
      expect(() => root.replace(index, replacement)).toThrow(RangeError)
    }
    expect(root.snapshot()).toEqual([kept])
  })

  test("rejects invalid imports and replacements before changing content", () => {
    const store = getStore()
    const { choice, exercise } = definitions()
    const initial = createUnit(choice, choiceFields())
    const { root } = createDocument(store, object({ exercise }), { exercise: initial })
    const revision = store.getRevision()
    for (const invalid of [
      null,
      [],
      {},
      { ...initial, id: "" },
      { ...initial, id: 3 },
      { ...initial, id: undefined },
      { ...initial, type: "unknown" },
      { ...initial, question: undefined },
      { ...initial, question: false },
      { ...initial, extra: true },
      { ...initial, answers: [{ text: "Answer", correct: "yes" }] },
      { ...initial, answers: [{ text: "Answer", correct: true, extra: true }] },
      { ...initial, answers: "wrong" },
    ]) {
      // JSON.parse models untyped imported data.
      expect(() => root.set("exercise", JSON.parse(JSON.stringify(invalid)))).toThrow()
    }
    expect(root.snapshot()).toEqual({ exercise: initial })
    expect(store.getRevision()).toBe(revision)
    expect(() => {
      // @ts-expect-error Creation requires declared fields.
      createUnit(choice, { question: "Incomplete" })
    }).toThrow()
    expect(() => {
      // @ts-expect-error New-unit input cannot supply an ID.
      createUnit(choice, { ...choiceFields(), id: "provided" })
    }).toThrow("Unknown field: id.")
    expect(() => {
      // @ts-expect-error Creation retains declared field types.
      createUnit(choice, { ...choiceFields(), question: false })
    }).toThrow("Expected string cell.")
  })

  test("composes rich-text fields without exporting internal editor IDs", () => {
    const schema = unit({
      type: "text",
      fields: { body: richText({ definition: definition.inline() }) },
      render: () => null,
    })
    const body = { type: "doc", content: [{ type: "inlineBlock" }] }
    const initial = createUnit(schema, { body })
    const { root } = createDocument(getStore(), schema, initial)
    expect(root.snapshot()).toEqual(initial)
    expect(root.field("body").id).not.toBe(root.id)
  })
})

test("rejects reserved fields, empty unit types and ambiguous child definitions", () => {
  expect(() => {
    // @ts-expect-error ID is reserved.
    unit({ type: "bad", fields: { id: string() }, render: () => null })
  }).toThrow("Reserved unit field: id.")
  expect(() => {
    // @ts-expect-error Type is reserved.
    unit({ type: "bad", fields: { type: string() }, render: () => null })
  }).toThrow("Reserved unit field: type.")
  expect(() => unit({ type: "", fields: {}, render: () => null })).toThrow("Expected unit type.")
  const { choice } = definitions()
  expect(() => childUnit([])).toThrow("Expected at least one child unit definition.")
  expect(() => childUnit([choice, choice])).toThrow("Duplicate unit type: choice.")
})

test("Yjs replicas bind matching IDs to local definitions and retain sibling identities", () => {
  const firstDoc = new Y.Doc()
  const secondDoc = new Y.Doc()
  const firstStore = new YjsNodeStore({ doc: firstDoc, awareness: new Awareness(firstDoc) })
  const secondStore = new YjsNodeStore({ doc: secondDoc, awareness: new Awareness(secondDoc) })
  const local = definitions()
  const remote = definitions()
  try {
    const kept = createUnit(local.choice, choiceFields())
    const first = createDocument(firstStore, array(local.exercise), [kept]).root
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = createDocument(secondStore, array(remote.exercise), []).root
    expect(second.children()[0]!.id).toBe(kept.id)
    expect(second.children()[0]!.definition).toBe(remote.choice)
    expect(second.children()[0]!.definition).not.toBe(local.choice)

    first.insert(0, createUnit(local.forensic, { caseId: "new" }))
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

test("invalid nested imports allocate no Yjs fragments", () => {
  const doc = new Y.Doc()
  const store = new YjsNodeStore({ doc, awareness: new Awareness(doc) })
  const schema = unit({
    type: "text",
    fields: { body: richText({ definition: definition.inline() }), title: string() },
    render: () => null,
  })
  const before = Y.encodeStateAsUpdate(doc)
  try {
    expect(() => {
      schema.create(store, {
        id: "saved",
        type: "text",
        body: { type: "doc", content: [{ type: "inlineBlock" }] },
        // @ts-expect-error Untyped import has invalid title after valid rich text.
        title: false,
      })
    }).toThrow()
    expect([...doc.share.keys()]).toEqual(["storage:revisions"])
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  } finally {
    doc.destroy()
  }
})
