import { useState } from "react"

import { ExerciseBadge } from "../components/ExerciseBadge"
import { number, richText, unit } from "../schema"
import type { PrimitiveHandle } from "../schema/primitives"
import { FieldLabel, TaskField, taskDefinition } from "./shared"

export const FreeText = unit({
  type: "free-text",
  fields: {
    task: richText({ definition: taskDefinition }),
    /** learners can only submit once their answer is at least this long */
    minLength: number(),
  },
  render: ({ handle }) => {
    const minLength = handle.field("minLength")
    return (
      <div className="exercise">
        <ExerciseBadge label="Freitext" help="Lernende schreiben eine freie Antwort." />
        <TaskField handle={handle.field("task")} />
        <FieldLabel hint="Erst ab dieser Länge können Lernende ihre Antwort abschicken. 0 bedeutet keine Mindestlänge.">
          Mindestlänge der Antwort
        </FieldLabel>
        <label className="number-field">
          <MinLengthInput handle={minLength} />
          Zeichen
        </label>
      </div>
    )
  },
})

/** Keeps the typed text while editing, so the field can be emptied; empty stores 0. */
function MinLengthInput({ handle }: { handle: PrimitiveHandle<number> }) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      type="number"
      className="text-input text-input--number"
      min={0}
      step={10}
      value={draft ?? handle.get()}
      onChange={(event) => {
        const text = event.currentTarget.value
        const value = Number.parseInt(text, 10)
        setDraft(text)
        handle.set(Number.isNaN(value) ? 0 : Math.max(0, value))
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
