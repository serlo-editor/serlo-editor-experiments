import clsx from "clsx"
import { useState } from "react"

import { ExerciseBadge } from "../../editor/components/ExerciseBadge"
import type { ChoiceValue } from "../../editor/content"
import { CheckBar, type CheckStatus, plainText, PreviewRichText, PreviewTask } from "./shared"

export function ChoicePreview({
  handle,
  mode,
}: {
  handle: ChoiceValue
  mode: "single" | "multiple"
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [status, setStatus] = useState<CheckStatus>("unchecked")
  // empty answers are still being written, learners never see them
  const options = handle.options.children().filter((option) => plainText(option.text).trim())
  const isChecked = status === "correct" || status === "incorrect"

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      if (mode === "single") return new Set([id])
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    setStatus("unchecked")
  }

  function check() {
    const isCorrect = options.every(
      (option) => option.isCorrect.get() === selected.has(option.text.id),
    )
    setStatus(isCorrect ? "correct" : "incorrect")
  }

  return (
    <section className="exercise">
      {mode === "single" ? (
        <ExerciseBadge label="Single Choice" help="Wähle die passende Antwort aus." />
      ) : (
        <ExerciseBadge label="Multiple Choice" help="Wähle alle passenden Antworten aus." />
      )}
      <PreviewTask handle={handle.task} />
      <div className="choice-options">
        {options.map((option) => {
          const text = option.text
          const isSelected = selected.has(text.id)
          return (
            <label
              key={text.id}
              className={clsx(
                "choice-card",
                isChecked && isSelected && option.isCorrect.get() && "choice-card--correct",
                isChecked && isSelected && !option.isCorrect.get() && "choice-card--incorrect",
              )}
            >
              <PreviewRichText handle={text} inline />
              <input
                type={mode === "single" ? "radio" : "checkbox"}
                name={mode === "single" ? `choice-${handle.task.id}` : undefined}
                checked={isSelected}
                disabled={isChecked}
                onChange={(event) => toggle(text.id, event.currentTarget.checked)}
              />
            </label>
          )
        })}
      </div>
      <CheckBar
        status={status}
        canCheck={selected.size > 0}
        onCheck={check}
        onRetry={() => {
          setSelected(new Set())
          setStatus("unchecked")
        }}
      />
    </section>
  )
}
