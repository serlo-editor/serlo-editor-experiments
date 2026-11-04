import clsx from "clsx"
import { CheckCheck, RotateCcw } from "lucide-react"
import { DOMSerializer } from "prosekit/pm/model"
import { type DragEvent, useCallback, useEffect, useRef } from "react"

import { renderStaticRichText } from "../../editor/rich-text"
import type { RichTextHandle } from "../../editor/schema/rich-text"

export type CheckStatus = "unchecked" | "correct" | "incorrect" | "submitted"

/** a gap of the text, replaced by an empty element learners fill */
export interface GapSlot {
  answer: string
  element: HTMLElement
}

/** one draggable answer, correct ones and decoys alike */
export interface Chip {
  id: string
  text: string
}

export function PreviewRichText({
  handle,
  inline = false,
  onGaps,
}: {
  handle: RichTextHandle
  inline?: boolean
  /** receives empty slots in place of the gaps, to render inputs or drop zones into */
  onGaps?: (gaps: GapSlot[]) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const setHost = useCallback((element: HTMLElement | null) => {
    ref.current = element
  }, [])
  const HTMLTag = inline ? "span" : "div"
  const schema = handle.getEditor().schema
  const content = JSON.stringify(handle.snapshot())

  useEffect(() => {
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
      schema.nodeFromJSON(JSON.parse(content)).content,
    )
    const gaps = Array.from(fragment.querySelectorAll<HTMLElement>(".gap-mark"), (gap) => {
      const slot = document.createElement("span")
      slot.className = "preview-slot"
      const answer = gap.textContent ?? ""
      gap.replaceWith(slot)
      return { answer, element: slot }
    })
    renderStaticRichText(fragment)
    ref.current?.replaceChildren(fragment)
    onGaps?.(gaps)
  }, [content, schema, onGaps])

  // Keep serialized DOM and learner answers outside React's editable content tree.
  return <HTMLTag ref={setHost} className="preview-rich-text" />
}

/** Task text of an exercise, hidden while it is still empty. */
export function PreviewTask({ handle }: { handle: RichTextHandle }) {
  // a task can consist of an image or a formula alone, so check the structure, not the text
  const { doc } = handle.getEditor().state
  if (doc.childCount === 1 && doc.firstChild?.content.size === 0) return null
  return (
    <div className="exercise__prompt">
      <PreviewRichText handle={handle} />
    </div>
  )
}

export function CheckBar({
  status,
  canCheck,
  onCheck,
  onRetry,
  checkLabel = "Überprüfen",
}: {
  status: CheckStatus
  canCheck: boolean
  onCheck: () => void
  onRetry: () => void
  checkLabel?: string
}) {
  return (
    <div className={`check-bar check-bar--${status}`}>
      {status !== "unchecked" ? (
        <p className="check-bar__message" role="status">
          {status === "correct" && "🥳 Genau richtig!"}
          {status === "submitted" && "🥳 Danke für deine Antwort!"}
          {status === "incorrect" && "🐸 Das stimmt leider noch nicht ganz."}
        </p>
      ) : null}
      {status === "unchecked" ? (
        <button type="button" className="check-bar__button" disabled={!canCheck} onClick={onCheck}>
          <CheckCheck aria-hidden="true" />
          {checkLabel}
        </button>
      ) : null}
      {status === "incorrect" ? (
        <button type="button" className="check-bar__button" onClick={onRetry}>
          <RotateCcw aria-hidden="true" />
          Nochmal probieren
        </button>
      ) : null}
    </div>
  )
}

/** Tapping moves the chip, dragging drops it on a target that reads `dropChipId`. */
export function ChipButton({
  chip,
  disabled,
  isPicked = false,
  onClick,
}: {
  chip: Chip
  disabled: boolean
  isPicked?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={clsx("chip", isPicked && "chip--picked")}
      draggable={!disabled}
      disabled={disabled}
      aria-pressed={isPicked}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", chip.id)}
      onClick={(event) => {
        // chips inside drop targets must not trigger the target's own click
        event.stopPropagation()
        onClick()
      }}
    >
      {chip.text}
    </button>
  )
}

/** Props making an element accept dropped chips. */
export function dropTarget(onDrop: (chipId: string) => void) {
  return {
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const chipId = event.dataTransfer.getData("text/plain")
      if (chipId) onDrop(chipId)
    },
  }
}

export function plainText(handle: RichTextHandle) {
  return handle.getEditor().state.doc.textContent
}

/** whitespace and case are irrelevant when comparing learner input */
export function normalizeAnswer(text: string) {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("de")
}

/** Stable order per preview session, so chips do not jump around while answering. */
export function shuffle<Item extends { id: string }>(items: Item[], seed: number): Item[] {
  const rank = (id: string) => {
    let hash = Math.floor(seed * 2 ** 31)
    for (const char of id) hash = (Math.imul(hash ^ char.charCodeAt(0), 2654435761) >>> 0) % 2 ** 31
    return hash
  }
  return [...items].sort((a, b) => rank(a.id) - rank(b.id))
}
