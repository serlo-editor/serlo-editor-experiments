import { ExerciseBadge } from "../components/ExerciseBadge"
import { array, richText, unit } from "../schema"
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

export const TextInput = unit({
  type: "text-input",
  fields: {
    task: richText({ definition: taskDefinition }),
    /** every listed answer is accepted as correct */
    answers: array(richText({ definition: answerDefinition })),
  },
  render: ({ handle }) => {
    const answers = handle.field("answers")
    const addAnswer = (index: number) =>
      insertAndFocus(answers, index, emptyInlineText, (answer) => answer)
    return (
      <div className="exercise">
        <ExerciseBadge label="Texteingabe" help="Lernende tippen ihre Antwort ein." />
        <TaskField handle={handle.field("task")} />
        <FieldLabel hint="Jede dieser Eingaben wird als richtig gewertet. Groß- und Kleinschreibung zählt nicht.">
          Richtige Antworten
        </FieldLabel>
        <ul className="answer-list">
          {answers.map((answer, index) => (
            <li key={answer.id}>
              <AnswerRow
                handle={answer}
                onRemove={() => answers.remove(index)}
                onEnter={() => addAnswer(index + 1)}
                onDeleteEmpty={() => removeAndFocus(answers, index, (answer) => answer)}
              />
            </li>
          ))}
        </ul>
        <AddButton onClick={() => addAnswer(answers.length)}>Weitere Antwort hinzufügen</AddButton>
      </div>
    )
  },
})
