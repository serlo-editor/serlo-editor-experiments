import clsx from "clsx"
import { useState } from "react"
import { createPortal } from "react-dom"

import { ExerciseBadge } from "../../editor/components/ExerciseBadge"
import type { DragAndDropBlanks, FillInTheBlank } from "../../editor/content"
import type { HandleOf } from "../../editor/schema/types"
import {
  CheckBar,
  type CheckStatus,
  type Chip,
  ChipButton,
  dropTarget,
  type GapSlot,
  normalizeAnswer,
  PreviewRichText,
  shuffle,
} from "./shared"

export function FillInTheBlankPreview({ handle }: { handle: HandleOf<typeof FillInTheBlank> }) {
  const [gaps, setGaps] = useState<GapSlot[]>([])
  const [values, setValues] = useState<Readonly<Record<number, string>>>({})
  const [status, setStatus] = useState<CheckStatus>("unchecked")
  const isChecked = status === "correct" || status === "incorrect"
  const isGapCorrect = (gap: GapSlot, index: number) =>
    normalizeAnswer(values[index] ?? "") === normalizeAnswer(gap.answer)

  return (
    <section className="exercise">
      <ExerciseBadge label="Lückentext" help="Tippe die richtigen Antworten in die Lücken." />
      <p className="exercise__instructions">Tippe die richtigen Antworten in die Lücken</p>
      <PreviewRichText handle={handle.field("content")} onGaps={setGaps} />
      {gaps.map((gap, index) =>
        createPortal(
          <input
            type="text"
            className={clsx(
              "preview-gap",
              isChecked && (isGapCorrect(gap, index) ? "is-correct" : "is-incorrect"),
            )}
            aria-label={`Lücke ${index + 1}`}
            autoComplete="off"
            readOnly={isChecked}
            value={values[index] ?? ""}
            onChange={(event) => {
              const value = event.currentTarget.value
              setValues((current) => ({ ...current, [index]: value }))
              setStatus("unchecked")
            }}
          />,
          gap.element,
          String(index),
        ),
      )}
      <CheckBar
        status={status}
        canCheck={Object.values(values).some((value) => value.trim())}
        onCheck={() => setStatus(gaps.every(isGapCorrect) ? "correct" : "incorrect")}
        onRetry={() => {
          setValues({})
          setStatus("unchecked")
        }}
      />
    </section>
  )
}

export function DragAndDropBlanksPreview({
  handle,
}: {
  handle: HandleOf<typeof DragAndDropBlanks>
}) {
  const [gaps, setGaps] = useState<GapSlot[]>([])
  /** which chip sits in which gap */
  const [placed, setPlaced] = useState<Readonly<Record<number, string>>>({})
  const [status, setStatus] = useState<CheckStatus>("unchecked")
  const [seed] = useState(Math.random)
  const isChecked = status === "correct" || status === "incorrect"

  const chips = shuffle(
    [
      ...gaps.map((gap, index) => ({ id: `gap:${index}`, text: gap.answer })),
      ...handle
        .field("extraAnswers")
        .map((answer, index) => ({ id: `extra:${index}`, text: answer.get() })),
    ].filter((chip) => chip.text.trim()),
    seed,
  )
  const chipById = (id: string | undefined) => chips.find((chip) => chip.id === id)
  const placedIds = new Set(Object.values(placed))
  const pool = chips.filter((chip) => !placedIds.has(chip.id))
  const isGapCorrect = (gap: GapSlot, index: number) =>
    normalizeAnswer(chipById(placed[index])?.text ?? "") === normalizeAnswer(gap.answer)

  function place(chipId: string, index: number) {
    setPlaced((current) => {
      const next = withoutChip(current, chipId)
      next[index] = chipId
      return next
    })
    setStatus("unchecked")
  }

  function unplace(chipId: string) {
    setPlaced((current) => withoutChip(current, chipId))
    setStatus("unchecked")
  }

  /** tapping a chip fills the first empty gap, no dragging needed */
  function placeInFirstEmpty(chipId: string) {
    const index = gaps.findIndex((_, gapIndex) => !chipById(placed[gapIndex]))
    if (index !== -1) place(chipId, index)
  }

  return (
    <section className="exercise">
      <ExerciseBadge
        label="Lückentext (Drag & Drop)"
        help="Ziehe die richtigen Antworten in die Lücken."
      />
      <p className="exercise__instructions">Ziehe die richtigen Antworten in die Lücken</p>
      <PreviewRichText handle={handle.field("content")} onGaps={setGaps} />
      {gaps.map((gap, index) => {
        const chip = chipById(placed[index])
        return createPortal(
          <span
            className={clsx(
              "drop-slot",
              chip && "drop-slot--filled",
              isChecked && (isGapCorrect(gap, index) ? "is-correct" : "is-incorrect"),
            )}
            {...(isChecked ? {} : dropTarget((chipId) => place(chipId, index)))}
          >
            {chip ? (
              <ChipButton chip={chip} disabled={isChecked} onClick={() => unplace(chip.id)} />
            ) : null}
          </span>,
          gap.element,
          String(index),
        )
      })}
      <ChipPool chips={pool} disabled={isChecked} onTap={placeInFirstEmpty} onDrop={unplace} />
      <CheckBar
        status={status}
        canCheck={placedIds.size > 0}
        onCheck={() => setStatus(gaps.every(isGapCorrect) ? "correct" : "incorrect")}
        onRetry={() => {
          setPlaced({})
          setStatus("unchecked")
        }}
      />
    </section>
  )
}

export function ChipPool({
  chips,
  disabled,
  pickedId,
  onTap,
  onDrop,
}: {
  chips: Chip[]
  disabled: boolean
  pickedId?: string | null
  onTap: (chipId: string) => void
  /** chips dropped on the pool leave their target */
  onDrop: (chipId: string) => void
}) {
  return (
    <div className="chip-pool" aria-label="Antworten" {...dropTarget(onDrop)}>
      {chips.map((chip) => (
        <ChipButton
          key={chip.id}
          chip={chip}
          disabled={disabled}
          isPicked={chip.id === pickedId}
          onClick={() => onTap(chip.id)}
        />
      ))}
    </div>
  )
}

function withoutChip(placed: Readonly<Record<number, string>>, chipId: string) {
  const next: Record<number, string> = {}
  for (const [index, id] of Object.entries(placed)) if (id !== chipId) next[Number(index)] = id
  return next
}
