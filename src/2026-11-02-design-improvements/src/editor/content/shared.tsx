import { Plus, Trash2 } from "lucide-react"
import { Selection } from "prosekit/pm/state"
import { type ReactNode, useState } from "react"

import { type ItemKeys, RichText, RichTextField } from "../components/RichText"
import { richText as definition, type RichTextJSON } from "../rich-text"
import type { ArrayHandle } from "../schema/array"
import type { PrimitiveHandle } from "../schema/primitives"
import type { RichTextHandle } from "../schema/rich-text"
import type { Handle } from "../schema/types"
import type { JSONValue } from "../utils"

/** Tasks get every rich-text tool the editor supports. */
export const taskDefinition = definition.block({
  marks: { bold: true, italic: true, link: true },
  blocks: {
    paragraph: true,
    heading: true,
    orderedList: true,
    bulletList: true,
    codeBlock: true,
    math: true,
    spoiler: true,
    box: true,
    image: true,
    video: true,
    geogebra: true,
    table: true,
  },
})
/** Choice options are single lines with light formatting. */
export const optionDefinition = definition.inline({ marks: { bold: true, italic: true } })
/** Answers learners type are compared as plain text. */
export const answerDefinition = definition.inline()

export const emptyInlineText: RichTextJSON = { type: "doc", content: [{ type: "inlineBlock" }] }

export function TaskField({ handle }: { handle: RichTextHandle }) {
  return (
    <>
      <FieldLabel>Aufgabenstellung</FieldLabel>
      <RichTextField handle={handle} className="exercise__question" />
    </>
  )
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <>
      <h3 className="exercise__field-label">{children}</h3>
      {hint ? <p className="exercise__hint">{hint}</p> : null}
    </>
  )
}

export function AnswerRow({
  handle,
  onRemove,
  onEnter,
  onDeleteEmpty,
}: {
  handle: RichTextHandle
  onRemove: () => void
} & ItemKeys) {
  return (
    <div className="answer-input">
      <RichText handle={handle} inline onEnter={onEnter} onDeleteEmpty={onDeleteEmpty} />
      <button
        type="button"
        className="answer-input__remove"
        aria-label="Antwort löschen"
        title="Antwort löschen"
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

/**
 * Wrong answers as removable tags, added through a small input. They are plain strings
 * because they never need formatting.
 */
export function ExtraAnswersPanel({
  answers,
  hint,
}: {
  answers: ArrayHandle<string, PrimitiveHandle<string>>
  hint: string
}) {
  const [draft, setDraft] = useState("")
  const values = answers.map((answer) => answer.get())

  function add() {
    const text = draft.trim()
    if (!text) return
    if (!values.includes(text)) answers.insert(answers.length, text)
    setDraft("")
  }

  return (
    <div className="extra-answers">
      <FieldLabel hint={hint}>Falsche Antworten</FieldLabel>
      {values.length > 0 ? (
        <ul className="extra-answers__tags">
          {values.map((answer, index) => (
            <li key={`${index}:${answer}`} className="extra-answers__tag">
              {answer}
              <button
                type="button"
                className="extra-answers__remove"
                aria-label={`${answer} entfernen`}
                title={`${answer} entfernen`}
                onClick={() => answers.remove(index)}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="exercise__hint">Noch keine falschen Antworten.</p>
      )}
      <p className="extra-answers__label">Antwort hinzufügen</p>
      <div className="extra-answers__row">
        <input
          className="text-input"
          aria-label="Falsche Antwort"
          placeholder="Eine falsche Antwort"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            add()
          }}
        />
        <button
          type="button"
          className="extra-answers__add"
          aria-label="Antwort hinzufügen"
          disabled={!draft.trim()}
          onClick={add}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/** Inserts an item and moves the cursor into its text once the new editor is mounted. */
export function insertAndFocus<Item extends JSONValue, Child extends Handle<Item>>(
  list: ArrayHandle<Item, Child>,
  index: number,
  item: Item,
  textOf: (child: Child) => RichTextHandle,
) {
  list.insert(index, item)
  const inserted = list.children()[index]
  const editor = inserted === undefined ? undefined : textOf(inserted).getEditor()
  requestAnimationFrame(() => editor?.focus())
}

/** Removes an item and moves the cursor to the end of the one before it (or after, if first). */
export function removeAndFocus<Item extends JSONValue, Child extends Handle<Item>>(
  list: ArrayHandle<Item, Child>,
  index: number,
  textOf: (child: Child) => RichTextHandle,
) {
  list.remove(index)
  const neighbor = list.children()[Math.max(0, index - 1)]
  if (neighbor === undefined) return
  const editor = textOf(neighbor).getEditor()
  editor.focus()
  if (index > 0) {
    editor.view.dispatch(editor.state.tr.setSelection(Selection.atEnd(editor.state.doc)))
  }
}
