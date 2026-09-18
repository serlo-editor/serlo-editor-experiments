import { type ReactNode } from "react"

import { educationalUnit, object, string, type EducationalUnitValue } from "../schema/index.ts"
import type { ViewContext } from "./context.ts"
import { DeleteButton, Feedback, UnitHead } from "./shared.tsx"

export const freeText = educationalUnit({
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
        <Feedback checked={context.checked} correct={correct} answer={unit.value.answer.get()} />
      </section>
    )
  },
})

export type FreeTextUnit = EducationalUnitValue<typeof freeText>

export function FreeTextEditor({ unit, onChange, onDelete }: EditorProps) {
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

type EditorProps = {
  unit: FreeTextUnit
  onChange(): void
  onDelete(): void
}
