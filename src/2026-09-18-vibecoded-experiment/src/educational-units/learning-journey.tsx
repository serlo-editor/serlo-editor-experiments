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
import { text } from "./text.tsx"
import { worksheet } from "./worksheet.tsx"

export const learningJourney = educationalUnit({
  type: "learning-journey",
  schema: object({
    title: string(),
    units: array(child(text, multipleChoice, freeText, worksheet)),
  }),
  render(unit, context: ViewContext): ReactNode {
    const journey = context.journey
    if (!journey) return null

    if (journey.completed) {
      return (
        <article className="learning-journey journey-complete">
          <p className="eyebrow">Learning journey complete</p>
          <h1>{unit.value.title.get()}</h1>
          <p>You reached final card.</p>
          <button type="button" className="primary" onClick={journey.restart}>
            Start again
          </button>
        </article>
      )
    }

    const card = unit.value.units.at(journey.currentCard)
    if (!card) {
      return (
        <article className="learning-journey journey-complete">
          <h1>{unit.value.title.get()}</h1>
          <p>Add cards in edit mode to start journey.</p>
        </article>
      )
    }

    const lastCard = journey.currentCard === unit.value.units.length - 1

    return (
      <article className="learning-journey">
        <div className="worksheet-title">
          <div>
            <p className="eyebrow">Learning journey</p>
            <h1>{unit.value.title.get()}</h1>
          </div>
          <button type="button" onClick={() => context.edit(unit.id)}>
            Edit journey
          </button>
        </div>
        <div className="journey-layout">
          <nav className="journey-navigation" aria-label="Journey cards">
            <h2>Cards</h2>
            {unit.value.units.map((journeyCard, index) => (
              <button
                type="button"
                className={index === journey.currentCard ? "active" : ""}
                key={journeyCard.id}
                onClick={() => journey.select(index)}
              >
                Card {index + 1}: {journeyCard.type}
              </button>
            ))}
            <button
              type="button"
              className="add-card"
              onClick={() => context.add(unit.id, unit.value.units.length)}
            >
              + Add card
            </button>
          </nav>
          <div className="journey-card">
            <p className="eyebrow">Card {journey.currentCard + 1}</p>
            {card.render()}
            <div className="check-actions">
              {context.checked ? (
                <button type="button" className="primary" onClick={journey.next}>
                  {lastCard ? "Finish" : "Next"}
                </button>
              ) : (
                <button type="button" className="primary" onClick={context.check}>
                  Check answers
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    )
  },
})

export type LearningJourney = EducationalUnitValue<typeof learningJourney>
export type LearningJourneyChild = UnitValueOf<
  typeof text | typeof multipleChoice | typeof freeText | typeof worksheet
>

export const initialLearningJourney = {
  id: "learning-journey-1",
  type: "learning-journey" as const,
  title: "A trip through our solar system",
  units: [
    {
      id: "journey-text-1",
      type: "text" as const,
      text: "Welcome. Complete each card before moving forward.",
    },
    {
      id: "journey-choice-1",
      type: "multiple-choice" as const,
      question: "Which planet is known as red planet?",
      choices: [
        { text: "Earth", correct: false },
        { text: "Mars", correct: true },
        { text: "Saturn", correct: false },
      ],
    },
    {
      id: "journey-worksheet-1",
      type: "worksheet" as const,
      title: "Planet recap",
      units: [
        {
          id: "journey-worksheet-text-1",
          type: "text" as const,
          text: "Use what you learned in previous card.",
        },
        {
          id: "journey-worksheet-answer-1",
          type: "free-text" as const,
          question: "What is largest planet in solar system?",
          answer: "Jupiter",
        },
      ],
    },
  ],
}

export function LearningJourneyEditor({
  unit,
  onChange,
}: {
  unit: LearningJourney
  onChange(): void
}) {
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
