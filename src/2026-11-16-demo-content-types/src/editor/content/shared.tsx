import { Plus, Trash2 } from "lucide-react"
import { type ReactNode, useState } from "react"

import { RichText, RichTextField, type ItemKeys } from "../components/RichText"
import { richText as definition } from "../rich-text"
import { string, type AnySchema, type SnapshotOf, type StoredValueOf } from "../schema"
import type { StoredArray } from "../schema/array"
import type { StoredRichText } from "../schema/rich-text"

export const taskDefinition = definition.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})
export const optionDefinition = definition.inline({ marks: { bold: true, italic: true } })
export const answerDefinition = definition.inline()
export const emptyInlineText = { type: "doc", content: [{ type: "inlineBlock" }] }

export function TaskField({ value }: { value: StoredRichText }) {
  return (
    <>
      <FieldLabel>Aufgabenstellung</FieldLabel>
      <RichTextField handle={value} className="exercise__question" />
    </>
  )
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <>
      <h3 className="exercise__field-label">{children}</h3>
      {hint && <p className="exercise__hint">{hint}</p>}
    </>
  )
}

export function AnswerRow({
  value,
  onRemove,
  onEnter,
  onDeleteEmpty,
}: { value: StoredRichText; onRemove: () => void } & ItemKeys) {
  return (
    <div className="answer-input">
      <RichText handle={value} inline onEnter={onEnter} onDeleteEmpty={onDeleteEmpty} />
      <button
        type="button"
        className="answer-input__remove"
        aria-label="Antwort löschen"
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  )
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="add-answer" onClick={onClick}>
      <Plus aria-hidden="true" />
      {children}
    </button>
  )
}

export function ExtraAnswersPanel({
  answers,
  hint,
}: {
  answers: StoredArray<ReturnType<typeof string>>
  hint: string
}) {
  const [draft, setDraft] = useState("")
  const values = answers.map((answer) => answer.get())
  const add = () => {
    const text = draft.trim()
    if (text && !values.includes(text)) answers.insert(answers.length, text)
    setDraft("")
  }
  return (
    <div className="extra-answers">
      <FieldLabel hint={hint}>Falsche Antworten</FieldLabel>
      <ul className="extra-answers__tags">
        {values.map((value, index) => (
          <li key={`${index}:${value}`} className="extra-answers__tag">
            {value}
            <button
              type="button"
              className="extra-answers__remove"
              aria-label={`${value} entfernen`}
              onClick={() => answers.remove(index)}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="extra-answers__row">
        <input
          className="text-input"
          aria-label="Falsche Antwort"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <button
          type="button"
          className="extra-answers__add"
          aria-label="Antwort hinzufügen"
          onClick={add}
          disabled={!draft.trim()}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export function insertAndFocus<Schema extends AnySchema>(
  list: StoredArray<Schema>,
  index: number,
  value: SnapshotOf<Schema>,
  textOf: (child: StoredValueOf<Schema>) => StoredRichText,
) {
  list.insert(index, value)
  const inserted = list.children()[index]
  if (inserted) requestAnimationFrame(() => textOf(inserted).getEditor().focus())
}

export function removeAndFocus<Schema extends AnySchema>(
  list: StoredArray<Schema>,
  index: number,
  textOf: (child: StoredValueOf<Schema>) => StoredRichText,
) {
  list.remove(index)
  const neighbor = list.children()[Math.max(0, index - 1)]
  if (neighbor) requestAnimationFrame(() => textOf(neighbor).getEditor().focus())
}
