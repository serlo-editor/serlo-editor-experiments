import { Circle, CircleCheck, Square, SquareCheck } from "lucide-react"

import { ExerciseBadge } from "../components/ExerciseBadge"
import { array, boolean, object, richText, unit } from "../schema"
import type { ObjectHandle } from "../schema/object"
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

export const choiceFields = {
  task: richText({ definition: taskDefinition }),
  options: array(
    object({
      isCorrect: boolean(),
      text: richText({ definition: optionDefinition }),
    }),
  ),
}

export type ChoiceHandle = ObjectHandle<typeof choiceFields>

export const SingleChoice = unit({
  type: "single-choice",
  fields: choiceFields,
  render: ({ handle }) => (
    <div className="exercise">
      <ExerciseBadge label="Single Choice" help="Genau eine Antwort ist richtig." />
      <ChoiceEditor handle={handle} mode="single" />
    </div>
  ),
})

export const MultipleChoice = unit({
  type: "multiple-choice",
  fields: choiceFields,
  render: ({ handle }) => (
    <div className="exercise">
      <ExerciseBadge label="Multiple Choice" help="Mehrere Antworten können richtig sein." />
      <ChoiceEditor handle={handle} mode="multiple" />
    </div>
  ),
})

function ChoiceEditor({ handle, mode }: { handle: ChoiceHandle; mode: "single" | "multiple" }) {
  const options = handle.field("options")
  const addOption = (index: number) =>
    insertAndFocus(options, index, { isCorrect: false, text: emptyInlineText }, (option) =>
      option.field("text"),
    )

  // single choice: marking one answer correct unmarks all others
  const setCorrect = (index: number, isCorrect: boolean) => {
    if (mode === "multiple") {
      options.children()[index]?.field("isCorrect").set(isCorrect)
      return
    }
    options.map((option, other) => option.field("isCorrect").set(other === index))
  }

  return (
    <>
      <TaskField handle={handle.field("task")} />
      <FieldLabel>Antworten</FieldLabel>
      <ul className="answer-list">
        {options.map((option, index) => {
          const text = option.field("text")
          const isCorrect = option.field("isCorrect").get()
          return (
            <li key={text.id}>
              <AnswerRow
                handle={text}
                onRemove={() => options.remove(index)}
                onEnter={() => addOption(index + 1)}
                onDeleteEmpty={() =>
                  removeAndFocus(options, index, (option) => option.field("text"))
                }
              />
              <div className="correctness-slot">
                <label className={isCorrect ? "correctness correctness--correct" : "correctness"}>
                  <input
                    type={mode === "single" ? "radio" : "checkbox"}
                    className="visually-hidden"
                    checked={isCorrect}
                    onChange={(event) => setCorrect(index, event.currentTarget.checked)}
                  />
                  <CorrectnessIcon isCorrect={isCorrect} mode={mode} />
                  {isCorrect ? "Richtig" : "Falsch"}
                </label>
              </div>
            </li>
          )
        })}
      </ul>
      <AddButton onClick={() => addOption(options.length)}>Neue Antwort hinzufügen</AddButton>
    </>
  )
}

/** round like a radio button for single choice, square like a checkbox for multiple choice */
function CorrectnessIcon({ isCorrect, mode }: { isCorrect: boolean; mode: "single" | "multiple" }) {
  if (mode === "multiple") {
    return isCorrect ? <SquareCheck aria-hidden="true" /> : <Square aria-hidden="true" />
  }
  return isCorrect ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />
}
