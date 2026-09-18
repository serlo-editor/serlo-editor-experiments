import { type ReactNode } from "react"

import {
  array,
  boolean,
  educationalUnit,
  object,
  string,
  type EducationalUnitValue,
} from "../schema/index.ts"
import type { ViewContext } from "./context.ts"
import { DeleteButton, Feedback, UnitHead } from "./shared.tsx"

export const multipleChoice = educationalUnit({
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
        <Feedback
          checked={context.checked}
          correct={matches}
          answer={choices
            .filter((choice) => choice.correct.get())
            .map((choice) => choice.text.get())
            .join(", ")}
        />
      </section>
    )
  },
})

export type MultipleChoiceUnit = EducationalUnitValue<typeof multipleChoice>

export function MultipleChoiceEditor({ unit, onChange, onDelete }: EditorProps) {
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

type EditorProps = {
  unit: MultipleChoiceUnit
  onChange(): void
  onDelete(): void
}
