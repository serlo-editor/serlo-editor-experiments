import { type ReactNode } from "react"

import {
  array,
  child,
  educationalUnit,
  object,
  string,
  type EducationalUnitValue,
  type UnitValueOf,
} from "../schema/index.ts"
import type { ViewContext } from "./context.ts"
import { freeText } from "./free-text.tsx"
import { multipleChoice } from "./multiple-choice.tsx"
import { AddUnitButton } from "./shared.tsx"
import { text } from "./text.tsx"

export const worksheet = educationalUnit({
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
          <button type="button" onClick={() => context.edit(unit.id)}>
            Edit
          </button>
        </div>
        <div className="units">
          <AddUnitButton onClick={() => context.add(unit.id, 0)} />
          {unit.value.units.map((childUnit, index) => (
            <div className="unit-slot" key={childUnit.id}>
              {childUnit.render()}
              <AddUnitButton onClick={() => context.add(unit.id, index + 1)} />
            </div>
          ))}
        </div>
        {!context.journey && (
          <div className="check-actions">
            <button type="button" className="primary" onClick={context.check}>
              Check answers
            </button>
          </div>
        )}
      </article>
    )
  },
})

export type Worksheet = EducationalUnitValue<typeof worksheet>
export type WorksheetChild = UnitValueOf<typeof text | typeof multipleChoice | typeof freeText>

export const initialWorksheet = {
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

export function WorksheetEditor({ unit, onChange }: { unit: Worksheet; onChange(): void }) {
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
