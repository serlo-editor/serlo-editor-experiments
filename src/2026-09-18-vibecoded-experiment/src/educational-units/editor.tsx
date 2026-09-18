import { FreeTextEditor, type FreeTextUnit } from "./free-text.tsx"
import { MultipleChoiceEditor, type MultipleChoiceUnit } from "./multiple-choice.tsx"
import { DeleteButton } from "./shared.tsx"
import { TextEditor, type TextUnit } from "./text.tsx"
import { type Worksheet, WorksheetEditor } from "./worksheet.tsx"

export type EditableChildUnit = TextUnit | MultipleChoiceUnit | FreeTextUnit | Worksheet

export function ChildUnitEditor({ unit, onChange, onDelete }: EditorProps) {
  if (unit.type === "text") {
    return <TextEditor unit={unit} onChange={onChange} onDelete={onDelete} />
  }

  if (unit.type === "multiple-choice") {
    return <MultipleChoiceEditor unit={unit} onChange={onChange} onDelete={onDelete} />
  }

  if (unit.type === "free-text") {
    return <FreeTextEditor unit={unit} onChange={onChange} onDelete={onDelete} />
  }

  return (
    <>
      <WorksheetEditor unit={unit} onChange={onChange} />
      <DeleteButton onDelete={onDelete} />
    </>
  )
}

type EditorProps = {
  unit: EditableChildUnit
  onChange(): void
  onDelete(): void
}
