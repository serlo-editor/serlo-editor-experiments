import { Circle, CircleCheck, Square, SquareCheck } from "lucide-react"

import { ExerciseBadge } from "../components/ExerciseBadge"
import { array, block, boolean, object, richText, type StoredBlock } from "../schema"
import {
  AddButton,
  AnswerRow,
  emptyInlineText,
  FieldLabel,
  insertAndFocus,
  optionDefinition,
  removeAndFocus,
  TaskField,
  taskDefinition,
} from "./shared"

const fields = {
  task: richText({ definition: taskDefinition }),
  options: array(
    object({ isCorrect: boolean(), text: richText({ definition: optionDefinition }) }),
  ),
}
export type ChoiceValue = StoredBlock<"single-choice" | "multiple-choice", typeof fields>

export const SingleChoice = block({
  type: "single-choice",
  fields,
  render: ({ value }) => <ChoiceEditor value={value} mode="single" />,
})
export const MultipleChoice = block({
  type: "multiple-choice",
  fields,
  render: ({ value }) => <ChoiceEditor value={value} mode="multiple" />,
})

function ChoiceEditor({ value, mode }: { value: ChoiceValue; mode: "single" | "multiple" }) {
  const options = value.options
  const add = (index: number) =>
    insertAndFocus(
      options,
      index,
      { isCorrect: false, text: emptyInlineText },
      (option) => option.text,
    )
  const setCorrect = (index: number, checked: boolean) => {
    if (mode === "multiple") options.children()[index]?.isCorrect.set(checked)
    else options.map((option, other) => option.isCorrect.set(other === index))
  }
  return (
    <div className="exercise">
      <ExerciseBadge
        label={mode === "single" ? "Single Choice" : "Multiple Choice"}
        help={
          mode === "single"
            ? "Genau eine Antwort ist richtig."
            : "Mehrere Antworten können richtig sein."
        }
      />
      <TaskField value={value.task} />
      <FieldLabel>Antworten</FieldLabel>
      <ul className="answer-list">
        {options.map((option, index) => (
          <li key={option.text.id}>
            <AnswerRow
              value={option.text}
              onRemove={() => options.remove(index)}
              onEnter={() => add(index + 1)}
              onDeleteEmpty={() => removeAndFocus(options, index, (child) => child.text)}
            />
            <div className="correctness-slot">
              <label
                className={
                  option.isCorrect.get() ? "correctness correctness--correct" : "correctness"
                }
              >
                <input
                  className="visually-hidden"
                  type={mode === "single" ? "radio" : "checkbox"}
                  checked={option.isCorrect.get()}
                  onChange={(event) => setCorrect(index, event.currentTarget.checked)}
                />
                {mode === "single" ? (
                  option.isCorrect.get() ? (
                    <CircleCheck />
                  ) : (
                    <Circle />
                  )
                ) : option.isCorrect.get() ? (
                  <SquareCheck />
                ) : (
                  <Square />
                )}
                {option.isCorrect.get() ? "Richtig" : "Falsch"}
              </label>
            </div>
          </li>
        ))}
      </ul>
      <AddButton onClick={() => add(options.length)}>Neue Antwort hinzufügen</AddButton>
    </div>
  )
}
