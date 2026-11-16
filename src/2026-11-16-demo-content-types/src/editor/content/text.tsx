import { useState } from "react"

import { ExerciseBadge } from "../components/ExerciseBadge"
import { array, block, number, richText, type StoredValueOf } from "../schema"
import {
  AddButton,
  AnswerRow,
  answerDefinition,
  emptyInlineText,
  FieldLabel,
  insertAndFocus,
  removeAndFocus,
  TaskField,
  taskDefinition,
} from "./shared"

export const TextInput = block({
  type: "text-input",
  fields: {
    task: richText({ definition: taskDefinition }),
    answers: array(richText({ definition: answerDefinition })),
  },
  render: ({ value }) => <TextInputEditor value={value} />,
})

function TextInputEditor({ value }: { value: StoredValueOf<typeof TextInput> }) {
  const answers = value.answers
  const add = (index: number) => insertAndFocus(answers, index, emptyInlineText, (answer) => answer)
  return (
    <div className="exercise">
      <ExerciseBadge label="Texteingabe" help="Lernende tippen ihre Antwort ein." />
      <TaskField value={value.task} />
      <FieldLabel hint="Jede dieser Eingaben wird als richtig gewertet. Groß- und Kleinschreibung zählt nicht.">
        Richtige Antworten
      </FieldLabel>
      <ul className="answer-list">
        {answers.map((answer, index) => (
          <li key={answer.id}>
            <AnswerRow
              value={answer}
              onRemove={() => answers.remove(index)}
              onEnter={() => add(index + 1)}
              onDeleteEmpty={() => removeAndFocus(answers, index, (child) => child)}
            />
          </li>
        ))}
      </ul>
      <AddButton onClick={() => add(answers.length)}>Weitere Antwort hinzufügen</AddButton>
    </div>
  )
}

export const FreeText = block({
  type: "free-text",
  fields: { task: richText({ definition: taskDefinition }), minLength: number() },
  render: ({ value }) => (
    <div className="exercise">
      <ExerciseBadge label="Freitext" help="Lernende schreiben eine freie Antwort." />
      <TaskField value={value.task} />
      <FieldLabel hint="Erst ab dieser Länge können Lernende ihre Antwort abschicken. 0 bedeutet keine Mindestlänge.">
        Mindestlänge der Antwort
      </FieldLabel>
      <MinLengthInput value={value.minLength} />
    </div>
  ),
})

function MinLengthInput({ value }: { value: StoredValueOf<ReturnType<typeof number>> }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="number-field">
      <input
        type="number"
        className="text-input text-input--number"
        min={0}
        step={10}
        value={draft ?? value.get()}
        onChange={(event) => {
          const text = event.currentTarget.value
          const parsed = Number.parseInt(text, 10)
          setDraft(text)
          value.set(Number.isNaN(parsed) ? 0 : Math.max(0, parsed))
        }}
        onBlur={() => setDraft(null)}
      />
      Zeichen
    </label>
  )
}
