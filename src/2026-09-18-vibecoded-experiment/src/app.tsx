import { useState, type ReactNode } from "react"

import {
  array,
  boolean,
  child,
  createEducationalUnitStorage,
  educationalUnit,
  FlatStorageAdapter,
  object,
  Storage,
  string,
  type EducationalUnitValue,
  type UnitValueOf,
} from "./schema/index.ts"

import "./app.css"

type Answers = Record<string, readonly number[] | string>
type Focus = "worksheet" | string | null

type ViewContext = {
  readonly answers: Answers
  readonly checked: boolean
  add(index: number): void
  check(): void
  delete(id: string): void
  edit(id: string): void
  choose(id: string, choice: number, selected: boolean): void
  write(id: string, answer: string): void
}

const text = educationalUnit({
  type: "text",
  schema: object({ text: string() }),
  render(unit, context: ViewContext): ReactNode {
    return (
      <section className="unit">
        <UnitHead
          name="Text"
          onDelete={() => context.delete(unit.id)}
          onEdit={() => context.edit(unit.id)}
        />
        <textarea aria-label="Worksheet text" readOnly rows={3} value={unit.value.text.get()} />
      </section>
    )
  },
})

const multipleChoice = educationalUnit({
  type: "multiple-choice",
  schema: object({
    question: string(),
    choices: array(object({ text: string(), correct: boolean() })),
  }),
  render(unit, context: ViewContext): ReactNode {
    const answer = context.answers[unit.id]
    const selected = Array.isArray(answer) ? answer : []
    const choices = unit.value.choices.map((choice) => choice)
    const correct = choices.flatMap((choice, index) => (choice.correct.get() ? [index] : []))
    const matches =
      selected.length === correct.length && selected.every((choice) => correct.includes(choice))

    return (
      <section className="unit">
        <UnitHead
          name="Multiple choice"
          onDelete={() => context.delete(unit.id)}
          onEdit={() => context.edit(unit.id)}
        />
        <p className="question">{unit.value.question.get()}</p>
        <div className="answers">
          {choices.map((choice, index) => (
            <label className="answer" key={`${unit.id}-${index}`}>
              <input
                type="checkbox"
                checked={selected.includes(index)}
                onChange={(event) => context.choose(unit.id, index, event.target.checked)}
              />
              {choice.text.get()}
            </label>
          ))}
        </div>
        <Feedback checked={context.checked} correct={matches} />
      </section>
    )
  },
})

const freeText = educationalUnit({
  type: "free-text",
  schema: object({ question: string(), answer: string() }),
  render(unit, context: ViewContext): ReactNode {
    const storedAnswer = context.answers[unit.id]
    const answer = typeof storedAnswer === "string" ? storedAnswer : ""
    const correct =
      answer.trim().toLocaleLowerCase() === unit.value.answer.get().trim().toLocaleLowerCase()

    return (
      <section className="unit">
        <UnitHead
          name="Free text"
          onDelete={() => context.delete(unit.id)}
          onEdit={() => context.edit(unit.id)}
        />
        <p className="question">{unit.value.question.get()}</p>
        <textarea
          aria-label="Your answer"
          placeholder="Write your answer"
          rows={3}
          value={answer}
          onChange={(event) => context.write(unit.id, event.target.value)}
        />
        <Feedback checked={context.checked} correct={correct} />
      </section>
    )
  },
})

const worksheet = educationalUnit({
  type: "worksheet",
  schema: object({
    title: string(),
    units: array(child(text, multipleChoice, freeText)),
  }),
  render(unit, context: ViewContext): ReactNode {
    return (
      <article className="worksheet">
        <div className="worksheet-title">
          <h1>{unit.value.title.get()}</h1>
          <button type="button" onClick={() => context.edit("worksheet")}>
            Edit
          </button>
        </div>
        <div className="units">
          <AddUnitButton onClick={() => context.add(0)} />
          {unit.value.units.map((childUnit, index) => (
            <div className="unit-slot" key={childUnit.id}>
              {childUnit.render()}
              <AddUnitButton onClick={() => context.add(index + 1)} />
            </div>
          ))}
        </div>
        <div className="check-actions">
          <button type="button" className="primary" onClick={context.check}>
            Check answers
          </button>
        </div>
      </article>
    )
  },
})

type Worksheet = EducationalUnitValue<typeof worksheet>
type WorksheetChild = UnitValueOf<typeof text | typeof multipleChoice | typeof freeText>

const initialWorksheet = {
  id: "worksheet-1",
  type: "worksheet" as const,
  title: "Our solar system",
  units: [
    {
      id: "text-1",
      type: "text" as const,
      text: "Read each question, choose every answer you think is correct, then check your work.",
    },
    {
      id: "multiple-choice-1",
      type: "multiple-choice" as const,
      question: "Which planets are rocky planets?",
      choices: [
        { text: "Mercury", correct: true },
        { text: "Venus", correct: true },
        { text: "Jupiter", correct: false },
        { text: "Mars", correct: true },
      ],
    },
    {
      id: "free-text-1",
      type: "free-text" as const,
      question: "What star sits at centre of our solar system?",
      answer: "Sun",
    },
  ],
}

export default function App() {
  const [storage] = useState(() =>
    createEducationalUnitStorage({
      storage: new Storage(new FlatStorageAdapter()),
      units: [text, multipleChoice, freeText, worksheet],
    }),
  )
  const [reference] = useState(() => storage.save(initialWorksheet))
  const [focus, setFocus] = useState<Focus>(null)
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

  const openAddMenu = (index: number) => {
    setInsertAt(index)
    setAddMenuOpen(true)
  }
  const boundWorksheet = storage.bind(reference, {
    answers,
    checked,
    add: openAddMenu,
    check: () => setChecked(true),
    delete: deleteUnit,
    edit: setFocus,
    choose,
    write,
  })
  const units = boundWorksheet.value.units.map((unit) => unit)
  const focusedUnit =
    typeof focus === "string" ? units.find((unit) => unit.id === focus) : undefined

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
    <main className="editor-shell" data-revision={revision}>
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
              <h2>{focus === "worksheet" ? "Worksheet" : "Edit unit"}</h2>
              <button type="button" onClick={() => setFocus(null)}>
                Done editing
              </button>
            </div>
            {focus === "worksheet" ? (
              <WorksheetEditor unit={boundWorksheet} onChange={changed} />
            ) : focusedUnit ? (
              <UnitEditor
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
    </main>
  )
}

function UnitHead({ name, onDelete, onEdit }: { name: string; onDelete(): void; onEdit(): void }) {
  return (
    <div className="unit-head">
      <span>{name}</span>
      <div className="unit-actions">
        <button type="button" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}

function AddUnitButton({ onClick }: { onClick(): void }) {
  return (
    <button type="button" className="add-unit" onClick={onClick}>
      + Add unit
    </button>
  )
}

function Feedback({ checked, correct }: { checked: boolean; correct: boolean }) {
  return checked ? (
    <p className={`feedback ${correct ? "success" : "error"}`}>
      {correct ? "Correct" : "Try again"}
    </p>
  ) : null
}

function WorksheetEditor({ unit, onChange }: { unit: Worksheet; onChange(): void }) {
  return (
    <label>
      Title
      <input
        value={unit.value.title.get()}
        onChange={(event) => {
          unit.value.title.set(event.target.value)
          onChange()
        }}
      />
    </label>
  )
}

function UnitEditor({
  unit,
  onChange,
  onDelete,
}: {
  unit: WorksheetChild
  onChange(): void
  onDelete(): void
}) {
  if (unit.type === "text") {
    return (
      <>
        <label>
          Text
          <textarea
            rows={8}
            value={unit.value.text.get()}
            onChange={(event) => {
              unit.value.text.set(event.target.value)
              onChange()
            }}
          />
        </label>
        <DeleteButton onDelete={onDelete} />
      </>
    )
  }

  if (unit.type === "multiple-choice") {
    return (
      <>
        <label>
          Question
          <textarea
            rows={4}
            value={unit.value.question.get()}
            onChange={(event) => {
              unit.value.question.set(event.target.value)
              onChange()
            }}
          />
        </label>
        <div className="choice-editor">
          <div className="panel-head">
            <h3>Choices</h3>
            <button
              type="button"
              onClick={() => {
                unit.value.choices.push({ text: "New option", correct: false })
                onChange()
              }}
            >
              Add choice
            </button>
          </div>
          {unit.value.choices.map((choice, index) => (
            <div className="choice-row" key={index}>
              <input
                aria-label={`Choice ${index + 1}`}
                value={choice.text.get()}
                onChange={(event) => {
                  choice.text.set(event.target.value)
                  onChange()
                }}
              />
              <label className="correct-toggle">
                <input
                  type="checkbox"
                  checked={choice.correct.get()}
                  onChange={(event) => {
                    choice.correct.set(event.target.checked)
                    onChange()
                  }}
                />
                Correct
              </label>
              <button
                type="button"
                onClick={() => {
                  unit.value.choices.remove(index)
                  onChange()
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        <DeleteButton onDelete={onDelete} />
      </>
    )
  }

  return (
    <>
      <label>
        Question
        <textarea
          rows={4}
          value={unit.value.question.get()}
          onChange={(event) => {
            unit.value.question.set(event.target.value)
            onChange()
          }}
        />
      </label>
      <label>
        Correct answer
        <input
          value={unit.value.answer.get()}
          onChange={(event) => {
            unit.value.answer.set(event.target.value)
            onChange()
          }}
        />
      </label>
      <DeleteButton onDelete={onDelete} />
    </>
  )
}

function DeleteButton({ onDelete }: { onDelete(): void }) {
  return (
    <button type="button" className="delete-button" onClick={onDelete}>
      Delete unit
    </button>
  )
}
