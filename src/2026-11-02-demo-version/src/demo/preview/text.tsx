import clsx from "clsx"
import { useState } from "react"

import { ExerciseBadge } from "../../editor/components/ExerciseBadge"
import type { FreeText, TextInput } from "../../editor/content"
import type { HandleOf } from "../../editor/schema/types"
import { CheckBar, type CheckStatus, normalizeAnswer, plainText, PreviewTask } from "./shared"

export function TextInputPreview({ handle }: { handle: HandleOf<typeof TextInput> }) {
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<CheckStatus>("unchecked")
  const isChecked = status === "correct" || status === "incorrect"

  function check() {
    const input = normalizeAnswer(value)
    const isCorrect = handle
      .field("answers")
      .map(plainText)
      .some((answer) => answer.trim() && normalizeAnswer(answer) === input)
    setStatus(isCorrect ? "correct" : "incorrect")
  }

  return (
    <section className="exercise">
      <ExerciseBadge label="Texteingabe" help="Tippe deine Antwort in das Feld." />
      <PreviewTask handle={handle.field("task")} />
      <input
        type="text"
        className={clsx("preview-input", isChecked && `is-${status}`)}
        aria-label="Deine Antwort"
        placeholder="Tippe deine Antwort"
        autoComplete="off"
        readOnly={isChecked}
        value={value}
        onChange={(event) => {
          setValue(event.currentTarget.value)
          setStatus("unchecked")
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value.trim() && !isChecked) check()
        }}
      />
      <CheckBar
        status={status}
        canCheck={value.trim().length > 0}
        onCheck={check}
        onRetry={() => {
          setValue("")
          setStatus("unchecked")
        }}
      />
    </section>
  )
}

export function FreeTextPreview({ handle }: { handle: HandleOf<typeof FreeText> }) {
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<CheckStatus>("unchecked")
  const length = value.trim().length
  const missing = Math.max(0, handle.field("minLength").get() - length)

  return (
    <section className="exercise">
      <ExerciseBadge label="Freitext" help="Schreibe deine Antwort in das Feld." />
      <PreviewTask handle={handle.field("task")} />
      <textarea
        className="preview-input preview-input--multiline"
        aria-label="Deine Antwort"
        placeholder="Schreibe deine Antwort"
        readOnly={status === "submitted"}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      <p className="preview-counter" aria-live="polite">
        {missing > 0 ? `Noch ${missing} Zeichen` : `${length} Zeichen`}
      </p>
      <CheckBar
        status={status}
        canCheck={length > 0 && missing === 0}
        checkLabel="Abschicken"
        onCheck={() => setStatus("submitted")}
        onRetry={() => setStatus("unchecked")}
      />
    </section>
  )
}
