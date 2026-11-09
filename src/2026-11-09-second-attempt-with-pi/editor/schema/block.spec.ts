import { expect, test } from "bun:test"

import { richText as definition } from "../rich-text/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { object, richText, string, array, boolean, block } from "./index.ts"
import { openRoot } from "./root.ts"
import type { SnapshotOf } from "./types.ts"

function choice() {
  return block({
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
}

function choiceFields(question = "Which answer?") {
  return { question, answers: [{ text: "First", correct: true }], explanation: "Because" }
}

describeWithStores("block schemas", (getStore) => {
  test("creates flat snapshots with fresh IDs and typed stored values", () => {
    const blockDefinition = choice()
    const fields = choiceFields()
    const initial = blockDefinition.createSnapshot(fields)
    const other = blockDefinition.createSnapshot(fields)
    expect(initial.id).not.toBe(other.id)
    expect(initial).toEqual({ id: expect.any(String), type: "choice", ...fields })
    fields.answers[0]!.text = "Caller changed"
    expect(initial.answers[0]!.text).toBe("First")

    const suppliedMetadata = { ...choiceFields(), id: "caller", type: "other" }
    const fresh = blockDefinition.createSnapshot(suppliedMetadata)
    expect(fresh.id).not.toBe("caller")
    expect(fresh.type).toBe("choice")

    const document = openRoot(getStore(), blockDefinition, initial)
    const value = document
    expect(value.id satisfies string).toBe(initial.id)
    expect(value.type satisfies "choice").toBe("choice")
    expect(value.definition).toBe(blockDefinition)
    expect(value.snapshot()).toEqual(initial)
    expect(value.question.get() satisfies string).toBe("Which answer?")
    expect(value.explanation.get()).toBe("Because")
    value.question.set("Updated")
    expect(document.snapshot()).toEqual({
      ...initial,
      question: "Updated",
      explanation: "Because",
    })
    expect(value.id).toBe(initial.id)
    expect(Object.keys(document.snapshot()).sort()).toEqual([
      "answers",
      "explanation",
      "id",
      "question",
      "type",
    ])

    // @ts-expect-error Required object fields have no replacement setter.
    expect(value.set).toBeUndefined()
    // @ts-expect-error Schemas have no validation hook.
    expect(blockDefinition.validate).toBeUndefined()

    // @ts-expect-error Snapshot retains literal discriminator.
    const wrongType: SnapshotOf<typeof blockDefinition> = { ...initial, type: "forensic" }
    // @ts-expect-error Required content fields retain their types.
    const wrongQuestion: SnapshotOf<typeof blockDefinition> = { ...initial, question: false }
    // @ts-expect-error Required content fields remain required.
    const missingFields: SnapshotOf<typeof blockDefinition> = { id: "missing", type: "choice" }
    // @ts-expect-error Snapshot creation requires declared content fields.
    const missingCreationFields: Parameters<typeof blockDefinition.createSnapshot>[0] = {}
    const wrongCreationFields: Parameters<typeof blockDefinition.createSnapshot>[0] = {
      ...choiceFields(),
      // @ts-expect-error Snapshot creation retains declared field types.
      question: false,
    }
    const metadataCreationFields: Parameters<typeof blockDefinition.createSnapshot>[0] = {
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

  test("generates distinct default identities within an array and across calls", () => {
    const schema = array(block({ type: "note", fields: { text: string() }, render: () => null }), {
      defaultLength: 2,
    })
    const first = schema.defaultValue()
    const second = schema.defaultValue()
    expect(first).toEqual([
      { id: expect.any(String), type: "note", text: "" },
      { id: expect.any(String), type: "note", text: "" },
    ])
    expect(first[0]!.id).not.toBe(first[1]!.id)
    expect(first[0]!.id).not.toBe(second[0]!.id)
    expect(openRoot(getStore(), schema, first).snapshot()).toEqual(first)
  })

  test("loading and reopening preserve IDs instead of creating new blocks", () => {
    const store = getStore()
    const blockDefinition = choice()
    const loaded = { ...blockDefinition.createSnapshot(choiceFields()), id: "previously-saved-id" }
    const first = openRoot(store, blockDefinition, loaded)
    const second = openRoot(
      store,
      blockDefinition,
      blockDefinition.createSnapshot(choiceFields("Ignored")),
    )
    expect(first.id).toBe(loaded.id)
    expect(second.id).toBe(loaded.id)
    expect(second.snapshot()).toEqual(loaded)
  })

  test("composes rich-text fields without exporting internal editor IDs", () => {
    const schema = block({
      type: "text",
      fields: { body: richText({ definition: definition.inline() }) },
      render: () => null,
    })
    const body = { type: "doc", content: [{ type: "inlineBlock" }] }
    const initial = schema.createSnapshot({ body })
    const root = openRoot(getStore(), schema, initial)
    expect(root.snapshot()).toEqual(initial)
    expect(root.body.id).not.toBe(root.id)
  })
})

test("rejects reserved fields and empty block types", () => {
  expect(() => {
    // @ts-expect-error ID is reserved.
    block({ type: "bad", fields: { id: string() }, render: () => null })
  }).toThrow("Reserved block field: id.")
  expect(() => {
    // @ts-expect-error Type is reserved.
    block({ type: "bad", fields: { type: string() }, render: () => null })
  }).toThrow("Reserved block field: type.")
  expect(() => block({ type: "", fields: {}, render: () => null })).toThrow("Expected block type.")
  expect(() =>
    block({ type: "bad", fields: { definition: string() }, render: () => null }),
  ).toThrow("Reserved block field: definition.")
})
