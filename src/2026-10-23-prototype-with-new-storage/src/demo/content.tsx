import { richText as definition } from "../editor/rich-text/index.ts"
import { createDocument } from "../editor/schema/document.ts"
import {
  array,
  boolean,
  childUnit,
  object,
  richText,
  unit,
  UnitView,
} from "../editor/schema/index.ts"
import type { SnapshotOf } from "../editor/schema/types.ts"
import { FlatNodeStore } from "../editor/storage/index.ts"
import { RichTextField } from "./RichTextField.tsx"

export const { Prototype, TextUnit, MultipleChoiceUnit, FillInTheGapUnit } = createUnits()
export type PrototypeSnapshot = SnapshotOf<typeof Prototype>
export type LegacyContent = readonly ReturnType<typeof exportContent>[number][]

/** Converts typed legacy content; existing schemas validate it before any shared-store writes. */
export function importContent(content: LegacyContent): PrototypeSnapshot {
  if (!Array.isArray(content)) throw new TypeError("Expected a content array.")
  const snapshot = Prototype.createUnit({
    items: content.map((item) => {
      switch (item.type) {
        case "text":
          return TextUnit.createUnit({ content: item.content })
        case "fill-in-the-blank":
          return FillInTheGapUnit.createUnit({ content: item.content })
        case "multiple-choice":
          return MultipleChoiceUnit.createUnit({ question: item.question, options: item.options })
        default:
          throw new TypeError("Unknown content type.")
      }
    }),
  })
  // Reuse schema validation in an isolated store; never leave partial imports in Yjs.
  return createDocument(new FlatNodeStore(), Prototype, snapshot).snapshot()
}

export function exportContent(snapshot: PrototypeSnapshot) {
  return snapshot.items.map((item) => {
    if (item.type === "multiple-choice") {
      return { type: item.type, question: item.question, options: item.options }
    }
    return { type: item.type, content: item.content }
  })
}

function createUnits() {
  const TextUnit = createTextUnit()
  const MultipleChoiceUnit = createMultipleChoiceUnit()
  const FillInTheGapUnit = createFillInTheGapUnit()
  const Prototype = unit({
    type: "prototype",
    fields: { items: array(childUnit([TextUnit, MultipleChoiceUnit, FillInTheGapUnit])) },
    render: function PrototypeView({ handle }) {
      return (
        <div className="editor-content">
          {handle.field("items").map((child) => (
            <UnitView key={child.id} handle={child} />
          ))}
        </div>
      )
    },
  })
  return { Prototype, TextUnit, MultipleChoiceUnit, FillInTheGapUnit }
}

function createTextUnit() {
  return unit({
    type: "text",
    fields: {
      content: richText({
        definition: definition.block({
          marks: { bold: true, italic: true },
          blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
        }),
      }),
    },
    render: function TextView({ handle }) {
      return <RichTextField handle={handle.field("content")} label="Text content" />
    },
  })
}

function createMultipleChoiceUnit() {
  const inline = richText({
    definition: definition.inline({ marks: { bold: true, italic: true } }),
  })
  return unit({
    type: "multiple-choice",
    fields: {
      question: inline,
      options: array(object({ isCorrect: boolean(), text: inline })),
    },
    render: function MultipleChoiceView({ handle }) {
      return (
        <section className="exercise exercise--multiple-choice">
          <p>Multiple Choice Exercise</p>
          <RichTextField handle={handle.field("question")} label="Question" inline />
          <ul className="multiple-choice-options">
            {handle.field("options").map((option, index) => {
              const text = option.field("text")
              const correct = option.field("isCorrect")
              return (
                <li key={text.id}>
                  <input
                    type="checkbox"
                    aria-label={`Option ${index + 1} is correct`}
                    checked={correct.get()}
                    onChange={(event) => correct.set(event.currentTarget.checked)}
                  />
                  <RichTextField handle={text} label={`Option ${index + 1}`} inline />
                </li>
              )
            })}
          </ul>
        </section>
      )
    },
  })
}

function createFillInTheGapUnit() {
  return unit({
    type: "fill-in-the-blank",
    fields: {
      content: richText({
        definition: definition.block({
          marks: { bold: true, italic: true, gap: true },
          blocks: { paragraph: true },
        }),
      }),
    },
    render: function FillInTheGapView({ handle }) {
      return (
        <section className="exercise exercise--fill-blank">
          <p>Fill in the Gap Exercise</p>
          <RichTextField handle={handle.field("content")} label="Gap exercise content" />
        </section>
      )
    },
  })
}
