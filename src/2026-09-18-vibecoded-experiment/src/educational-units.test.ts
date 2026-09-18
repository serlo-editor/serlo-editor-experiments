import assert from "node:assert/strict"
import test from "node:test"

import {
  child,
  createEducationalUnitStorage,
  educationalUnit,
  FlatStorageAdapter,
  object,
  Storage,
  string,
} from "./schema/index.ts"

type RenderContext = { readonly prefix: string }

const text = educationalUnit({
  type: "text",
  schema: object({ text: string() }),
  render(unit, context: RenderContext) {
    return `${context.prefix}text:${unit.value.text.get()}`
  },
})

const image = educationalUnit({
  type: "image",
  schema: object({ url: string() }),
  render(unit, context: RenderContext) {
    return `${context.prefix}image:${unit.value.url.get()}`
  },
})

const exercise = educationalUnit({
  type: "exercise",
  schema: object({
    title: string(),
    question: child(text),
    answer: child(text, image),
  }),
  render(unit, context: RenderContext) {
    return `${context.prefix}exercise:${unit.value.title.get()} [${unit.value.question.render()}] [${unit.value.answer.render()}]`
  },
})

const exerciseJSON = {
  id: "exercise-1",
  type: "exercise" as const,
  title: "Pythagoras",
  question: { id: "text-1", type: "text" as const, text: "What is c?" },
  answer: { id: "image-1", type: "image" as const, url: "triangle.svg" },
}

const createStorage = () =>
  createEducationalUnitStorage({
    storage: new Storage(new FlatStorageAdapter()),
    units: [text, image, exercise],
  })

test("saves, loads, and renders nested educational units", () => {
  const units = createStorage()
  const reference = units.save(exerciseJSON)
  const bound = units.bind(reference, { prefix: "render " })

  assert.equal(
    bound.render(),
    "render exercise:Pythagoras [render text:What is c?] [render image:triangle.svg]",
  )
  assert.deepEqual(units.load(reference), exerciseJSON)
})

test("bind exposes mutable values through nested child units", () => {
  const units = createStorage()
  const reference = units.save(exerciseJSON)
  const bound = units.bind(reference, { prefix: "" })

  bound.value.question.value.text.set("What is hypotenuse?")

  assert.deepEqual(units.load(reference), {
    ...exerciseJSON,
    question: { ...exerciseJSON.question, text: "What is hypotenuse?" },
  })
})

test("rejects child unit type outside field definition", () => {
  const units = createStorage()

  assert.throws(
    () =>
      units.save({
        ...exerciseJSON,
        question: { id: "image-2", type: "image" as const, url: "wrong.svg" },
      } as never),
    /Unit type image is not allowed in this child field/,
  )
})

test("rejects duplicate and reserved unit definitions", () => {
  assert.throws(
    () => educationalUnit({ type: "broken", schema: object({ id: string() }), render: () => null }),
    /id and type are reserved/,
  )

  assert.throws(
    () =>
      createEducationalUnitStorage({
        storage: new Storage(new FlatStorageAdapter()),
        units: [text, text],
      }),
    /Duplicate educational unit type: text/,
  )
})
