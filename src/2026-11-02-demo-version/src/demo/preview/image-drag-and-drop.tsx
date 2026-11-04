import clsx from "clsx"
import { useState } from "react"

import { ExerciseBadge } from "../../editor/components/ExerciseBadge"
import { type ImageDragAndDrop, type ZoneHandle, zoneRect, zoneStyle } from "../../editor/content"
import type { HandleOf } from "../../editor/schema/types"
import { ChipPool } from "./blanks"
import {
  CheckBar,
  type CheckStatus,
  ChipButton,
  dropTarget,
  normalizeAnswer,
  plainText,
  PreviewTask,
  shuffle,
} from "./shared"

export function ImageDragAndDropPreview({ handle }: { handle: HandleOf<typeof ImageDragAndDrop> }) {
  /** which zone each placed chip sits in */
  const [placed, setPlaced] = useState<Readonly<Record<string, string>>>({})
  /** chip tapped in the pool, the next tapped zone receives it */
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [status, setStatus] = useState<CheckStatus>("unchecked")
  const [seed] = useState(Math.random)
  const isChecked = status === "correct" || status === "incorrect"
  const image = handle.field("image").get()
  const zonesVisible = handle.field("zonesVisible").get()
  const zones = handle.field("zones").children()

  const chips = shuffle(
    [
      ...zones
        .flatMap((zone) => zone.field("answers").children())
        .map((answer) => ({ id: answer.id, text: plainText(answer) })),
      ...handle
        .field("extraAnswers")
        .map((answer, index) => ({ id: `extra:${index}`, text: answer.get() })),
    ].filter((chip) => chip.text.trim()),
    seed,
  )
  const pool = chips.filter((chip) => !placed[chip.id])
  const chipsIn = (zoneId: string) => chips.filter((chip) => placed[chip.id] === zoneId)

  function place(chipId: string, zoneId: string) {
    setPlaced((current) => ({ ...current, [chipId]: zoneId }))
    setPickedId(null)
    setStatus("unchecked")
  }

  function unplace(chipId: string) {
    setPlaced((current) => {
      const next = { ...current }
      delete next[chipId]
      return next
    })
    setStatus("unchecked")
  }

  /** the zone is solved when exactly its answers are in it, no more, no less */
  function isZoneSolved(zone: ZoneHandle) {
    const expected = zone
      .field("answers")
      .map((answer) => normalizeAnswer(plainText(answer)))
      .filter(Boolean)
      .sort()
    const given = chipsIn(zone.field("id").get())
      .map((chip) => normalizeAnswer(chip.text))
      .sort()
    return expected.length === given.length && expected.every((text, i) => text === given[i])
  }

  return (
    <section className="exercise">
      <ExerciseBadge
        label="Drag & Drop Bild"
        help="Ziehe die Antworten auf die passenden Stellen."
      />
      <PreviewTask handle={handle.field("task")} />
      <div className="zone-canvas">
        {image ? (
          <img className="zone-canvas__image" src={image} alt="" draggable={false} />
        ) : (
          <div className="zone-canvas__blank" />
        )}
        {zones.map((zone) => {
          const id = zone.field("id").get()
          const title = zone.field("title").get()
          return (
            <div
              key={id}
              className={clsx(
                "drop-zone",
                zonesVisible && "drop-zone--visible",
                pickedId && "drop-zone--targetable",
                isChecked && (isZoneSolved(zone) ? "is-correct" : "is-incorrect"),
              )}
              style={zoneStyle(zoneRect(zone))}
              onClick={() => pickedId && !isChecked && place(pickedId, id)}
              {...(isChecked ? {} : dropTarget((chipId) => place(chipId, id)))}
            >
              {zonesVisible && title ? <span className="drop-zone__title">{title}</span> : null}
              {chipsIn(id).map((chip) => (
                <ChipButton
                  key={chip.id}
                  chip={chip}
                  disabled={isChecked}
                  onClick={() => unplace(chip.id)}
                />
              ))}
            </div>
          )
        })}
      </div>
      <ChipPool
        chips={pool}
        disabled={isChecked}
        pickedId={pickedId}
        onTap={(chipId) => setPickedId((current) => (current === chipId ? null : chipId))}
        onDrop={unplace}
      />
      <CheckBar
        status={status}
        canCheck={Object.keys(placed).length > 0}
        onCheck={() => setStatus(zones.every(isZoneSolved) ? "correct" : "incorrect")}
        onRetry={() => {
          setPlaced({})
          setStatus("unchecked")
        }}
      />
    </section>
  )
}
