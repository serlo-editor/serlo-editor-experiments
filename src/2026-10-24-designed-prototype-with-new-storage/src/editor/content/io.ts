import {
  FillInTheBlank,
  gapDefinition,
  inlineDefinition,
  MultipleChoice,
  type RootSnapshot,
  TextContent,
  textDefinition,
} from "."
import { createRichTextEditor, type RichTextDefinition, type RichTextJSON } from "../rich-text"
import type { JSONValue } from "../utils"
import { isObject } from "../utils/guard"

export type ContentJSON = readonly (
  | { type: "text" | "fill-in-the-blank"; content: RichTextJSON }
  | {
      type: "multiple-choice"
      question: RichTextJSON
      options: readonly { isCorrect: boolean; text: RichTextJSON }[]
    }
)[]

/** Validate the whole import before any shared document or fragment is allocated. */
export function importContent(value: unknown): RootSnapshot {
  if (!Array.isArray(value)) throw new TypeError("Expected content array.")
  return Array.from(value, (item: unknown) => {
    if (!isObject(item)) throw new TypeError("Expected content item.")
    switch (item.type) {
      case "text":
        checkFields(item, ["type", "content"])
        return TextContent.createUnit({ content: readRichText(item.content, textDefinition) })
      case "fill-in-the-blank":
        checkFields(item, ["type", "content"])
        return FillInTheBlank.createUnit({ content: readRichText(item.content, gapDefinition) })
      case "multiple-choice": {
        checkFields(item, ["type", "question", "options"])
        if (!Array.isArray(item.options)) throw new TypeError("Expected options array.")
        return MultipleChoice.createUnit({
          question: readRichText(item.question, inlineDefinition),
          options: Array.from(item.options, (option: unknown) => {
            if (!isObject(option)) throw new TypeError("Expected option.")
            checkFields(option, ["isCorrect", "text"])
            if (typeof option.isCorrect !== "boolean")
              throw new TypeError("Expected correctness boolean.")
            return {
              isCorrect: option.isCorrect,
              text: readRichText(option.text, inlineDefinition),
            }
          }),
        })
      }
      default:
        throw new TypeError(`Unknown content type: ${String(item.type)}.`)
    }
  })
}

/** Preserve the old external format, without unit IDs or internal rich-text IDs. */
export function exportContent(snapshot: RootSnapshot): ContentJSON {
  return snapshot.map((item) => {
    if (item.type === "multiple-choice") {
      return {
        type: item.type,
        question: structuredClone(item.question),
        options: structuredClone(item.options),
      }
    }
    return { type: item.type, content: structuredClone(item.content) }
  })
}

function readRichText(value: unknown, definition: RichTextDefinition): RichTextJSON {
  if (!isObject(value) || value.type !== "doc" || !isJSON(value)) {
    throw new TypeError("Expected ProseMirror document JSON.")
  }
  const editor = createRichTextEditor({ definition })
  const node = editor.schema.nodeFromJSON(value)
  node.check()
  return node.toJSON()
}

function checkFields(value: Readonly<Record<string, unknown>>, fields: readonly string[]) {
  if (
    fields.some((field) => !Object.hasOwn(value, field)) ||
    Object.keys(value).some((field) => !fields.includes(field))
  ) {
    throw new TypeError(`Expected fields: ${fields.join(", ")}.`)
  }
}

function isJSON(value: unknown): value is JSONValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return Array.from(value).every(isJSON)
  return isObject(value) && Object.values(value).every(isJSON)
}
