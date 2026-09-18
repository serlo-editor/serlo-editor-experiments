import { useState } from "react"

import type { Answers } from "../educational-units/context.ts"
import { ChildUnitEditor } from "../educational-units/editor.tsx"
import { freeText } from "../educational-units/free-text.tsx"
import { multipleChoice } from "../educational-units/multiple-choice.tsx"
import { text } from "../educational-units/text.tsx"
import {
  initialWorksheet,
  type WorksheetChild,
  WorksheetEditor,
  worksheet,
} from "../educational-units/worksheet.tsx"
import { createEducationalUnitStorage, FlatStorageAdapter, Storage } from "../schema/index.ts"

export function WorksheetBuilder() {
  const [storage] = useState(() =>
    createEducationalUnitStorage({
      storage: new Storage(new FlatStorageAdapter()),
      units: [text, multipleChoice, freeText, worksheet],
    }),
  )
  const [reference] = useState(() => storage.save(initialWorksheet))
  const [focus, setFocus] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [insertAt, setInsertAt] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [checked, setChecked] = useState(false)
  const [revision, setRevision] = useState(0)

  const changed = () => {
    setChecked(false)
    setRevision((value) => value + 1)
  }
  const choose = (id: string, choice: number, selected: boolean) => {
    setChecked(false)
    setAnswers((current) => {
      const existing = current[id]
      const choices = Array.isArray(existing) ? existing : []
      const next = selected ? [...choices, choice] : choices.filter((value) => value !== choice)
      return { ...current, [id]: next }
    })
  }
  const write = (id: string, answer: string) => {
    setChecked(false)
    setAnswers((current) => ({ ...current, [id]: answer }))
  }
  const boundWorksheet = storage.bind(reference, {
    answers,
    checked,
    journey: null,
    add: openAddMenu,
    check: () => setChecked(true),
    delete: deleteUnit,
    edit: setFocus,
    choose,
    write,
  })
  const units = boundWorksheet.value.units.map((unit) => unit)
  const focusedUnit = focus ? units.find((unit) => unit.id === focus) : undefined

  function openAddMenu(parentId: string, index: number) {
    if (parentId !== boundWorksheet.id) return

    setInsertAt(index)
    setAddMenuOpen(true)
  }
  const addUnit = (type: WorksheetChild["type"]) => {
    const id = `${type}-${crypto.randomUUID()}`
    const unit =
      type === "text"
        ? { id, type, text: "New text" }
        : type === "multiple-choice"
          ? {
              id,
              type,
              question: "New question",
              choices: [
                { text: "Option 1", correct: false },
                { text: "Option 2", correct: false },
              ],
            }
          : { id, type, question: "New question", answer: "Answer" }

    boundWorksheet.value.units.insert(insertAt, unit)
    setAddMenuOpen(false)
    setFocus(id)
    changed()
  }
  function deleteUnit(id: string) {
    const index = units.findIndex((unit) => unit.id === id)
    if (index < 0) return

    boundWorksheet.value.units.remove(index)
    if (focus === id) setFocus(null)
    changed()
  }

  return (
    <section className="builder-shell" data-revision={revision}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Educational unit editor</p>
          <h1>Worksheet builder</h1>
        </div>
      </header>

      <section className={`workspace ${focus ? "editing" : ""}`}>
        {focus && (
          <aside className="editor-panel">
            <div className="panel-head">
              <h2>{focus === boundWorksheet.id ? "Worksheet" : "Edit unit"}</h2>
              <button type="button" onClick={() => setFocus(null)}>
                Done editing
              </button>
            </div>
            {focus === boundWorksheet.id ? (
              <WorksheetEditor unit={boundWorksheet} onChange={changed} />
            ) : focusedUnit ? (
              <ChildUnitEditor
                unit={focusedUnit}
                onChange={changed}
                onDelete={() => deleteUnit(focusedUnit.id)}
              />
            ) : null}
          </aside>
        )}
        <section className="preview-panel">
          <div className="panel-head">
            <h2>View mode</h2>
          </div>
          {boundWorksheet.render()}
        </section>
      </section>

      {addMenuOpen && (
        <div className="overlay" role="presentation" onMouseDown={() => setAddMenuOpen(false)}>
          <section
            aria-labelledby="add-unit-title"
            aria-modal="true"
            className="add-menu"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-head">
              <h2 id="add-unit-title">Add educational unit</h2>
              <button type="button" onClick={() => setAddMenuOpen(false)}>
                Close
              </button>
            </div>
            <button type="button" onClick={() => addUnit("text")}>
              Text
            </button>
            <button type="button" onClick={() => addUnit("multiple-choice")}>
              Multiple choice
            </button>
            <button type="button" onClick={() => addUnit("free-text")}>
              Free text
            </button>
          </section>
        </div>
      )}
    </section>
  )
}
