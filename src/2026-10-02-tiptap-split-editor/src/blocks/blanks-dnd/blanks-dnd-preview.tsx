import { HelpCircle } from "lucide-react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { DeviceFrame } from "@/components/device-frame"
import { DragScrollArea } from "@/components/drag-scroll-area"
import { PreviewHeader } from "@/components/preview-header"
import { RichTextOutput } from "@/components/rich-text-output"
import { ValidationSheet } from "@/components/validation-sheet"
import { statusBackground, type ValidationStatus } from "@/components/validation-status"
import { cn } from "@/utils/cn"

import {
  BLANK_ATTRIBUTE,
  isAnswerCorrect,
  readAnswer,
  type BlanksDndState,
  type Highlight,
} from "./state"

/** a blank placeholder element inside the rendered text */
interface Slot {
  id: string
  answer: string
  element: HTMLElement
}

/** one draggable answer, correct ones and decoys alike */
interface Chip {
  id: string
  text: string
}

/** movement above this is a drag, below it a tap */
const DRAG_THRESHOLD_PX = 5
const DROP_ZONE_ATTRIBUTE = "data-drop-zone"
/** drop zone id of the answer pool, chips dropped there leave their blank */
const POOL_ZONE = "pool"

interface DragState {
  chipId: string
  x: number
  y: number
  /** where inside the chip it was grabbed, keeps the ghost under the pointer */
  offsetX: number
  offsetY: number
  width: number
  /** the blank under the pointer, if any */
  over: string | null
}

const chipStyle =
  "inline-flex items-center rounded-xl border border-neutral-300 px-3 py-1 font-sans text-2xl leading-normal shadow-md"

export function BlanksDndPreview({
  state,
  focus,
  onHighlight,
  onReset,
}: {
  state: BlanksDndState
  /** field focused in the editor, scrolled into view when it changes */
  focus: Highlight
  onHighlight: (highlight: Highlight) => void
  /** remounts the preview so answers, status and scroll position start over */
  onReset: () => void
}) {
  /** which chip sits in which blank */
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<ValidationStatus>("unchecked")
  const [slots, setSlots] = useState<Slot[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  // one shuffle per preview session, the order does not jump around while
  // the learner is answering
  const [seed] = useState(() => Math.random())
  const taskRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const poolRef = useRef<HTMLDivElement>(null)
  const zoneRefs = useRef(new Map<string, HTMLElement>())

  // the text is rendered as HTML, the drop zones are portalled into its blanks
  useLayoutEffect(() => {
    const container = textRef.current
    if (!container) return
    const elements = Array.from(container.querySelectorAll<HTMLElement>(`span[${BLANK_ATTRIBUTE}]`))
    setSlots(
      elements.map((element) => ({
        id: element.getAttribute(BLANK_ATTRIBUTE) ?? "",
        answer: readAnswer(element),
        element,
      })),
    )
  }, [state.text])

  const chips = useMemo<Chip[]>(() => {
    const all = [
      ...slots
        .filter((slot) => slot.answer)
        .map((slot) => ({ id: `blank:${slot.id}`, text: slot.answer })),
      ...state.extraAnswers.map((text, index) => ({
        id: `extra:${index}`,
        text,
      })),
    ]
    return shuffle(all, seed)
  }, [slots, state.extraAnswers, seed])

  // a chip that disappeared from the pool (answer edited) leaves its blank
  useEffect(() => {
    const ids = new Set(chips.map((chip) => chip.id))
    setPlaced((current) => {
      const kept = Object.entries(current).filter(([, chipId]) => ids.has(chipId))
      return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept)
    })
  }, [chips])

  useEffect(() => {
    if (!focus) return
    let element: HTMLElement | null | undefined = null
    if (focus.type === "task") element = taskRef.current
    if (focus.type === "text") element = textRef.current
    if (focus.type === "extra-answers") element = poolRef.current
    if (focus.type === "blank") element = zoneRefs.current.get(focus.id)
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focus])

  const isChecked = status === "correct" || status === "incorrect"
  const hasInput = Object.keys(placed).length > 0
  const chipById = (id: string) => chips.find((chip) => chip.id === id)
  const placedIds = new Set(Object.values(placed))
  const pool = chips.filter((chip) => !placedIds.has(chip.id))
  /** every blank is wide enough for the longest answer */
  const zoneWidth = `${Math.max(4, ...chips.map((chip) => chip.text.length)) + 2}ch`

  function place(chipId: string, slotId: string) {
    setPlaced((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([, id]) => id !== chipId))
      next[slotId] = chipId
      return next
    })
    setStatus("unchecked")
  }

  function remove(slotId: string) {
    setPlaced((current) => {
      const next = { ...current }
      delete next[slotId]
      return next
    })
    setStatus("unchecked")
  }

  /** returns the chip to the pool, wherever it sits */
  function unplace(chipId: string) {
    setPlaced((current) =>
      Object.fromEntries(Object.entries(current).filter(([, id]) => id !== chipId)),
    )
    setStatus("unchecked")
  }

  /** tapping a chip fills the first empty blank, no dragging needed */
  function placeInFirstEmpty(chipId: string) {
    const slot = slots.find((slot) => !placed[slot.id])
    if (slot) place(chipId, slot.id)
  }

  function check() {
    const allCorrect = slots.every((slot) =>
      isAnswerCorrect(slot.answer, chipById(placed[slot.id] ?? "")?.text ?? ""),
    )
    setStatus(allCorrect ? "correct" : "incorrect")
  }

  /** clears the learner input only, the exercise itself stays untouched */
  function reset() {
    setPlaced({})
    setStatus("retry")
  }

  /**
   * Pointer handlers of a chip. A short press is a tap (`onTap`), anything
   * longer drags a ghost of the chip and drops it on the blank it is
   * released over.
   */
  function chipHandlers(chip: Chip, onTap: () => void) {
    if (isChecked) return {}
    return {
      onPointerDown(event: React.PointerEvent<HTMLElement>) {
        if (event.button !== 0) return
        // the device screen scrolls on drag, this drag is ours
        event.stopPropagation()
        const element = event.currentTarget
        element.setPointerCapture(event.pointerId)
        const rect = element.getBoundingClientRect()
        const start = { x: event.clientX, y: event.clientY }
        let dragging = false

        const onMove = (move: PointerEvent) => {
          if (
            !dragging &&
            Math.hypot(move.clientX - start.x, move.clientY - start.y) < DRAG_THRESHOLD_PX
          )
            return
          dragging = true
          setDrag({
            chipId: chip.id,
            x: move.clientX,
            y: move.clientY,
            offsetX: start.x - rect.left,
            offsetY: start.y - rect.top,
            width: rect.width,
            over: zoneAt(move.clientX, move.clientY),
          })
        }
        const onEnd = (end: PointerEvent) => {
          element.removeEventListener("pointermove", onMove)
          element.removeEventListener("pointerup", onEnd)
          element.removeEventListener("pointercancel", onEnd)
          if (!dragging) {
            onTap()
            return
          }
          setDrag(null)
          if (end.type !== "pointerup") return
          const zone = zoneAt(end.clientX, end.clientY)
          if (zone === POOL_ZONE) unplace(chip.id)
          else if (zone) place(chip.id, zone)
        }
        element.addEventListener("pointermove", onMove)
        element.addEventListener("pointerup", onEnd)
        element.addEventListener("pointercancel", onEnd)
      },
    }
  }

  const dragged = drag ? chipById(drag.chipId) : undefined

  return (
    <div className="flex h-full flex-col bg-[#FAF6F6]/75 px-16 pb-16 pt-14">
      <PreviewHeader onReset={onReset} />

      <div className="flex min-h-0 flex-1 justify-center">
        <DeviceFrame>
          <DragScrollArea className="h-full">
            {/* generous bottom padding so the validation sheet never covers the pool */}
            <div className="px-6 pb-48 pt-8">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-0.5 text-sm font-bold text-neutral-500">
                Lückentext (Drag & Drop)
                <HelpCircle className="h-4 w-4" />
              </div>

              <RichTextOutput
                ref={taskRef}
                html={state.task}
                placeholder="[Schreibe links eine Aufgabenstellung]"
                onClick={() => onHighlight({ type: "task" })}
                className="mb-8"
              />

              <RichTextOutput
                ref={textRef}
                html={state.text}
                placeholder="[Schreibe links einen Lückentext]"
                onClick={() => onHighlight({ type: "text" })}
                className="leading-[2.75]"
              />

              {slots.map((slot) => {
                const chip = chipById(placed[slot.id] ?? "")
                const isCorrect = !!chip && isAnswerCorrect(slot.answer, chip.text)
                const isOver = drag?.over === slot.id
                const isDragged = !!chip && drag?.chipId === chip.id
                return createPortal(
                  <span
                    key={slot.id}
                    ref={(element) => {
                      if (element) zoneRefs.current.set(slot.id, element)
                      else zoneRefs.current.delete(slot.id)
                    }}
                    {...{ [DROP_ZONE_ATTRIBUTE]: slot.id }}
                    role={chip ? "button" : undefined}
                    aria-label={chip ? `${chip.text} entfernen` : "Lücke"}
                    style={{ minWidth: zoneWidth }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onHighlight({ type: "blank", id: slot.id })
                    }}
                    {...(chip ? chipHandlers(chip, () => remove(slot.id)) : {})}
                    className={cn(
                      "mx-1 min-h-[2.75rem] max-w-full touch-none align-middle",
                      chip
                        ? cn(chipStyle, !isChecked && "cursor-grab bg-white")
                        : "inline-flex items-center rounded-xl border border-dashed border-neutral-400 px-3 py-1 text-2xl leading-normal",
                      isOver && "ring-2 ring-indigo-300 ring-offset-1",
                      isDragged && "opacity-40",
                      // each checked blank shows its own result, `cn` does
                      // not merge classes so the plain backgrounds stay out
                      isChecked
                        ? isCorrect
                          ? statusBackground.correct
                          : statusBackground.incorrect
                        : !chip && "bg-neutral-50",
                    )}
                  >
                    {chip?.text ?? " "}
                  </span>,
                  slot.element,
                  slot.id,
                )
              })}

              <div
                ref={poolRef}
                {...{ [DROP_ZONE_ATTRIBUTE]: POOL_ZONE }}
                onClick={() => onHighlight({ type: "extra-answers" })}
                className={cn(
                  "mt-8 flex min-h-[3.5rem] flex-wrap gap-3 rounded-lg py-1",
                  // a chip from a blank can be dropped back here
                  drag?.over === POOL_ZONE &&
                    placedIds.has(drag.chipId) &&
                    "-mx-2 px-2 ring-2 ring-indigo-300",
                )}
              >
                {pool.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    disabled={isChecked}
                    {...chipHandlers(chip, () => placeInFirstEmpty(chip.id))}
                    className={cn(
                      chipStyle,
                      "touch-none bg-white",
                      isChecked ? "opacity-60" : "cursor-grab",
                      drag?.chipId === chip.id && "opacity-40",
                    )}
                  >
                    {chip.text}
                  </button>
                ))}
                {chips.length === 0 && (
                  <p className="text-2xl leading-snug text-neutral-300">
                    [Trage links Antworten in die Lücken ein]
                  </p>
                )}
              </div>
            </div>
          </DragScrollArea>

          <ValidationSheet
            isVisible={hasInput || status === "retry"}
            status={status}
            onCheck={check}
            onRetry={reset}
          />
        </DeviceFrame>
      </div>

      {drag &&
        dragged &&
        createPortal(
          <span
            aria-hidden
            style={{
              left: drag.x - drag.offsetX,
              top: drag.y - drag.offsetY,
              width: drag.width,
            }}
            className={cn(
              chipStyle,
              "pointer-events-none fixed z-50 rotate-2 justify-center bg-white shadow-xl",
            )}
          >
            {dragged.text}
          </span>,
          document.body,
        )}
    </div>
  )
}

/** id of the blank under the given point, if any */
function zoneAt(x: number, y: number) {
  return (
    document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>(`[${DROP_ZONE_ATTRIBUTE}]`)
      ?.getAttribute(DROP_ZONE_ATTRIBUTE) ?? null
  )
}

/** Fisher-Yates with a seeded generator, the same seed gives the same order */
function shuffle<T>(items: T[], seed: number) {
  const result = [...items]
  let value = Math.floor(seed * 2 ** 32) || 1
  const random = () => {
    // mulberry32
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
