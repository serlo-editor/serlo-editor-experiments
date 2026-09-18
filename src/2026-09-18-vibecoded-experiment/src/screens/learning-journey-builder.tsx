import { useState } from "react"

import type { Answers } from "../educational-units/context.ts"
import { type EditableChildUnit, ChildUnitEditor } from "../educational-units/editor.tsx"
import { freeText } from "../educational-units/free-text.tsx"
import {
  initialLearningJourney,
  LearningJourneyEditor,
  learningJourney,
  type LearningJourneyChild,
} from "../educational-units/learning-journey.tsx"
import { multipleChoice } from "../educational-units/multiple-choice.tsx"
import { text } from "../educational-units/text.tsx"
import { type WorksheetChild, worksheet } from "../educational-units/worksheet.tsx"
import { createEducationalUnitStorage, FlatStorageAdapter, Storage } from "../schema/index.ts"

type JourneyUnitType = LearningJourneyChild["type"]

export function LearningJourneyBuilder() {
  const [storage] = useState(() =>
    createEducationalUnitStorage({
      storage: new Storage(new FlatStorageAdapter()),
      units: [text, multipleChoice, freeText, worksheet, learningJourney],
    }),
  )
  const [reference] = useState(() => storage.save(initialLearningJourney))
  const [focus, setFocus] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addTarget, setAddTarget] = useState<string | null>(null)
  const [insertAt, setInsertAt] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [checked, setChecked] = useState(false)
  const [currentCard, setCurrentCard] = useState(0)
  const [completed, setCompleted] = useState(false)
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
  const boundJourney = storage.bind(reference, {
    answers,
    checked,
    journey: { currentCard, completed, next, restart, select },
    add: openAddMenu,
    check: () => setChecked(true),
    delete: deleteUnit,
    edit: setFocus,
    choose,
    write,
  })
  const cards = boundJourney.value.units.map((unit) => unit)
  const focusedUnit = focus ? findUnit(cards, focus) : undefined

  function next() {
    if (currentCard >= cards.length - 1) {
      setCompleted(true)
    } else {
      setCurrentCard((card) => card + 1)
      setChecked(false)
    }
  }
  function restart() {
    setCurrentCard(0)
    setChecked(false)
    setCompleted(false)
  }
  function select(card: number) {
    setCurrentCard(card)
    setChecked(false)
    setCompleted(false)
  }
  function openAddMenu(parentId: string, index: number) {
    if (parentId !== boundJourney.id && !findWorksheet(cards, parentId)) return

    setAddTarget(parentId)
    setInsertAt(index)
    setAddMenuOpen(true)
  }
  const addUnit = (type: JourneyUnitType) => {
    if (!addTarget) return

    const id = `${type}-${crypto.randomUUID()}`
    if (addTarget === boundJourney.id) {
      boundJourney.value.units.insert(insertAt, createJourneyUnit(id, type))
      setCurrentCard(insertAt)
      setCompleted(false)
    } else {
      const parent = findWorksheet(cards, addTarget)
      if (!parent || type === "worksheet") return

      parent.value.units.insert(insertAt, createWorksheetUnit(id, type))
    }

    setAddMenuOpen(false)
    setFocus(id)
    changed()
  }
  function deleteUnit(id: string) {
    const cardIndex = cards.findIndex((unit) => unit.id === id)
    if (cardIndex >= 0) {
      boundJourney.value.units.remove(cardIndex)
      setCurrentCard((card) => Math.min(card, Math.max(0, cards.length - 2)))
    } else {
      const parent = cards.find(
        (unit): unit is Extract<LearningJourneyChild, { type: "worksheet" }> =>
          unit.type === "worksheet" && unit.value.units.map((unit) => unit.id).includes(id),
      )
      if (!parent) return

      const unitIndex = parent.value.units.map((unit) => unit.id).indexOf(id)
      parent.value.units.remove(unitIndex)
    }

    if (focus === id) setFocus(null)
    changed()
  }

  return (
    <section className="builder-shell" data-revision={revision}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Educational unit editor</p>
          <h1>Learning journey</h1>
        </div>
      </header>

      <section className={`workspace ${focus ? "editing" : ""}`}>
        {focus && (
          <aside className="editor-panel">
            <div className="panel-head">
              <h2>{focus === boundJourney.id ? "Learning journey" : "Edit unit"}</h2>
              <button type="button" onClick={() => setFocus(null)}>
                Done editing
              </button>
            </div>
            {focus === boundJourney.id ? (
              <LearningJourneyEditor unit={boundJourney} onChange={changed} />
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
          {boundJourney.render()}
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
            {addTarget === boundJourney.id && (
              <button type="button" onClick={() => addUnit("worksheet")}>
                Worksheet
              </button>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

function findUnit(
  cards: readonly LearningJourneyChild[],
  id: string,
): EditableChildUnit | undefined {
  for (const card of cards) {
    if (card.id === id) return card
    if (card.type !== "worksheet") continue

    const child = card.value.units.map((unit) => unit).find((unit) => unit.id === id)
    if (child) return child
  }
}

function findWorksheet(cards: readonly LearningJourneyChild[], id: string) {
  return cards.find(
    (unit): unit is Extract<LearningJourneyChild, { type: "worksheet" }> =>
      unit.type === "worksheet" && unit.id === id,
  )
}

function createJourneyUnit(id: string, type: JourneyUnitType) {
  if (type === "worksheet") return { id, type, title: "New worksheet", units: [] }
  return createWorksheetUnit(id, type)
}

function createWorksheetUnit(id: string, type: WorksheetChild["type"]) {
  if (type === "text") return { id, type, text: "New text" }
  if (type === "multiple-choice") {
    return {
      id,
      type,
      question: "New question",
      choices: [
        { text: "Option 1", correct: false },
        { text: "Option 2", correct: false },
      ],
    }
  }
  return { id, type, question: "New question", answer: "Answer" }
}
