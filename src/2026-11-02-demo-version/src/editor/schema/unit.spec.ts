import { expect, test } from "bun:test"

import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { richText as definition } from "../rich-text/index.ts"
import { YjsNodeStore } from "../storage/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { createDocument } from "./document.ts"
import { array, boolean, childUnit, object, optional, richText, string, unit } from "./index.ts"
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
    const initial = choice.createUnit(fields)
    const other = choice.createUnit(fields)
    expect(initial.id).not.toBe(other.id)
    expect(initial).toEqual({ id: expect.any(String), type: "choice", ...fields })
    fields.answers[0]!.text = "Caller changed"
    expect(initial.answers[0]!.text).toBe("First")

    const suppliedMetadata = { ...choiceFields(), id: "caller", type: "other" }
    const fresh = choice.createUnit(suppliedMetadata)
    expect(fresh.id).not.toBe("caller")
    expect(fresh.type).toBe("choice")

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

    // @ts-expect-error Required object fields have no replacement setter.
    expect(handle.set).toBeUndefined()
    // @ts-expect-error Schemas have no validation hook.
    expect(choice.validate).toBeUndefined()
    expect(() => {
      // @ts-expect-error Metadata is read through properties, not field handles.
      handle.field("id")
    }).toThrow("Unknown field: id.")
    expect(() => {
      // @ts-expect-error Metadata cannot be set as an optional content field.
      handle.setOptional("type", "forensic")
    }).toThrow("Unknown field: type.")

    // @ts-expect-error Snapshot retains literal discriminator.
    const wrongType: SnapshotOf<typeof choice> = { ...initial, type: "forensic" }
    // @ts-expect-error Required content fields retain their types.
    const wrongQuestion: SnapshotOf<typeof choice> = { ...initial, question: false }
    // @ts-expect-error Required content fields remain required.
    const missingFields: SnapshotOf<typeof choice> = { id: "missing", type: "choice" }
    // @ts-expect-error Snapshot creation requires declared content fields.
    const missingCreationFields: Parameters<typeof choice.createUnit>[0] = {}
    const wrongCreationFields: Parameters<typeof choice.createUnit>[0] = {
      ...choiceFields(),
      // @ts-expect-error Snapshot creation retains declared field types.
      question: false,
    }
    const metadataCreationFields: Parameters<typeof choice.createUnit>[0] = {
      ...choiceFields(),
      // @ts-expect-error ID is generated, not a declared creation field.
      id: "provided",
    }
    void [
      wrongType,
      wrongQuestion,
      missingFields,
      missingCreationFields,
      wrongCreationFields,
      metadataCreationFields,
    ]
  })

  test("loading and reopening preserve IDs instead of creating new units", () => {
    const store = getStore()
    const { choice } = definitions()
    const loaded = { ...choice.createUnit(choiceFields()), id: "previously-saved-id" }
    const first = createDocument(store, choice, loaded)
    const second = createDocument(store, choice, choice.createUnit(choiceFields("Ignored")))
    expect(first.root.id).toBe(loaded.id)
    expect(second.root.id).toBe(loaded.id)
    expect(second.snapshot()).toEqual(loaded)
  })

  test("child unions narrow handles and support existing optional-field operations", () => {
    const store = getStore()
    const { choice, forensic, exercise } = definitions()
    const initial = choice.createUnit(choiceFields())
    const note = choice.createUnit(choiceFields("Note"))
    const schema = object({ exercise, note: optional(exercise) })
    const { root } = createDocument(store, schema, { exercise: initial, note })
    const required = root.field("exercise")
    expect(required.definition).toBe(choice)
    if (required.type === "choice") {
      expect(required.field("question").get() satisfies string).toBe("Which answer?")
      expect(() => {
        // @ts-expect-error Narrowed choice handles have no forensic fields.
        required.field("caseId")
      }).toThrow("Unknown field: caseId.")
    } else {
      throw new Error("Expected choice.")
    }
    const oldNote = root.field("note")!
    const replacement = forensic.createUnit({ caseId: "case-42" })
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

    const typed: HandleOf<typeof exercise> = current
    expect(typed.snapshot()).toEqual(replacement)
    const excluded = unit({ type: "excluded", fields: {}, render: () => null })
    expect(() => {
      // @ts-expect-error Only explicitly allowed unit types can occupy this child field.
      root.setOptional("note", excluded.createUnit({}))
    }).toThrow("Unknown child unit type: excluded.")
    root.removeOptional("note")
    expect(root.field("note")).toBeUndefined()
  })

  test("sibling insertions and removals preserve unchanged IDs", () => {
    const { choice, forensic, exercise } = definitions()
    const kept = choice.createUnit(choiceFields("Kept"))
    const inserted = forensic.createUnit({ caseId: "inserted" })
    const { root } = createDocument(getStore(), array(exercise), [kept])
    root.insert(0, inserted)
    expect(root.length).toBe(2)
    expect(root.children()[1]!.id).toBe(kept.id)
    expect(root.snapshot()).toEqual([inserted, kept])
    root.remove(0)
    expect(root.children()[0]!.id).toBe(kept.id)
    expect(root.snapshot()).toEqual([kept])
    // @ts-expect-error Array handles expose insert/remove, not replacement.
    expect(root.replace).toBeUndefined()
  })

  test("rejects invalid unit metadata and missing fields during insertion", () => {
    const { choice, exercise } = definitions()
    const initial = choice.createUnit(choiceFields())
    const { root } = createDocument(getStore(), array(exercise), [initial])
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
      "Expected unit ID.",
    )
    expect(() => {
      // @ts-expect-error A concrete unit schema rejects other type discriminators.
      choice.create(getStore(), { ...initial, type: "forensic" })
    }).toThrow("Expected unit type: choice.")
  })

  test("composes rich-text fields without exporting internal editor IDs", () => {
    const schema = unit({
      type: "text",
      fields: { body: richText({ definition: definition.inline() }) },
      render: () => null,
    })
    const body = { type: "doc", content: [{ type: "inlineBlock" }] }
    const initial = schema.createUnit({ body })
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
    const kept = local.choice.createUnit(choiceFields())
    const first = createDocument(firstStore, array(local.exercise), [kept]).root
    Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc))
    const second = createDocument(secondStore, array(remote.exercise), []).root
    expect(second.children()[0]!.id).toBe(kept.id)
    expect(second.children()[0]!.definition).toBe(remote.choice)
    expect(second.children()[0]!.definition).not.toBe(local.choice)

    first.insert(0, local.forensic.createUnit({ caseId: "new" }))
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
