import { type ReactNode } from "react"

import { educationalUnit, object, string, type EducationalUnitValue } from "../schema/index.ts"
import type { ViewContext } from "./context.ts"
import { DeleteButton, UnitHead } from "./shared.tsx"

export const text = educationalUnit({
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

export type TextUnit = EducationalUnitValue<typeof text>

export function TextEditor({ unit, onChange, onDelete }: EditorProps) {
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

type EditorProps = {
  unit: TextUnit
  onChange(): void
  onDelete(): void
}
