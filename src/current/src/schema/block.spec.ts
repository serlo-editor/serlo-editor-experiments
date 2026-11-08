import { expect, test } from "bun:test"

import { richText as definition } from "../rich-text/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { object, optional, richText, string, array, boolean, block } from "./index.ts"
import { createRoot } from "./root.ts"
import type { SnapshotOf } from "./types.ts"

function choice() {
  return block({
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
}

function choiceFields(question = "Which answer?") {
  return { question, answers: [{ text: "First", correct: true }] }
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

    const document = createRoot(getStore(), blockDefinition, initial)
    const value = document
    expect(value.id satisfies string).toBe(initial.id)
    expect(value.type satisfies "choice").toBe("choice")
    expect(value.definition).toBe(blockDefinition)
    expect(value.snapshot()).toEqual(initial)
    expect(value.field("question").get() satisfies string).toBe("Which answer?")
    expect(value.field("explanation")).toBeUndefined()
    value.field("question").set("Updated")
    value.setOptional("explanation", "Because")
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
    expect(() => {
      // @ts-expect-error Metadata is read through properties, not field values.
      value.field("id")
    }).toThrow("Unknown field: id.")
    expect(() => {
      // @ts-expect-error Metadata cannot be set as an optional content field.
      value.setOptional("type", "forensic")
    }).toThrow("Unknown field: type.")

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

  test("loading and reopening preserve IDs instead of creating new blocks", () => {
    const store = getStore()
    const blockDefinition = choice()
    const loaded = { ...blockDefinition.createSnapshot(choiceFields()), id: "previously-saved-id" }
    const first = createRoot(store, blockDefinition, loaded)
    const second = createRoot(
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
    const root = createRoot(getStore(), schema, initial)
    expect(root.snapshot()).toEqual(initial)
    expect(root.field("body").id).not.toBe(root.id)
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
})
