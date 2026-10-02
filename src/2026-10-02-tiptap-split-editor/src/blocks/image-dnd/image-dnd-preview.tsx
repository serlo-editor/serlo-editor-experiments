import { HelpCircle } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { DeviceFrame } from "@/components/device-frame"
import { DragScrollArea } from "@/components/drag-scroll-area"
import { PreviewHeader } from "@/components/preview-header"
import { RichTextOutput } from "@/components/rich-text-output"
import { ValidationSheet } from "@/components/validation-sheet"
import {
  statusBackground,
  statusBorder,
  type ValidationStatus,
} from "@/components/validation-status"
import { cn } from "@/utils/cn"

import { Canvas } from "./canvas"
import { isZoneSolved, zoneStyle, type DropZone, type Highlight, type ImageDndState } from "./state"

/** one draggable answer, correct ones and decoys alike */
interface Chip {
  id: string
  text: string
}

/** movement above this is a drag, below it a tap */
const DRAG_THRESHOLD_PX = 5
const DROP_ZONE_ATTRIBUTE = "data-drop-zone"
/** drop zone id of the answer pool, chips dropped there leave their zone */
const POOL_ZONE = "pool"

interface DragState {
  chipId: string
  x: number
  y: number
  /** where inside the chip it was grabbed, keeps the ghost under the pointer */
  offsetX: number
  offsetY: number
  width: number
  /** the zone under the pointer, if any */
  over: string | null
}

const chipStyle =
  "inline-flex items-center rounded-xl border border-neutral-300 px-3 py-1 font-sans text-xl leading-normal shadow-md"

export function ImageDndPreview({
  state,
  focus,
  onHighlight,
  onReset,
}: {
  state: ImageDndState
  /** field focused in the editor, scrolled into view when it changes */
  focus: Highlight
  onHighlight: (highlight: Highlight) => void
  /** remounts the preview so answers, status and scroll position start over */
  onReset: () => void
}) {
  /** which zone each placed chip sits in */
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<ValidationStatus>("unchecked")
  const [drag, setDrag] = useState<DragState | null>(null)
  // one shuffle per preview session, the order does not jump around while
  // the learner is answering
  const [seed] = useState(() => Math.random())
  const taskRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const poolRef = useRef<HTMLDivElement>(null)
  const zoneRefs = useRef(new Map<string, HTMLElement>())

  const chips = useMemo<Chip[]>(() => {
    const all = [
      ...state.zones.flatMap((zone) =>
        zone.answers.map((text, index) => ({
          id: `zone:${zone.id}:${index}`,
          text,
        })),
      ),
      ...state.extraAnswers.map((text, index) => ({
        id: `extra:${index}`,
        text,
      })),
    ]
    return shuffle(all, seed)
  }, [state.zones, state.extraAnswers, seed])

  // a chip or zone that disappeared (exercise edited) frees its placement
  useEffect(() => {
    const chipIds = new Set(chips.map((chip) => chip.id))
    const zoneIds = new Set(state.zones.map((zone) => zone.id))
    setPlaced((current) => {
      const kept = Object.entries(current).filter(
        ([chipId, zoneId]) => chipIds.has(chipId) && zoneIds.has(zoneId),
      )
      return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept)
    })
  }, [chips, state.zones])

  useEffect(() => {
    if (!focus) return
    let element: HTMLElement | null | undefined = null
    if (focus.type === "task") element = taskRef.current
    if (focus.type === "canvas") element = canvasRef.current
    if (focus.type === "extra-answers") element = poolRef.current
    if (focus.type === "zone") element = zoneRefs.current.get(focus.id)
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focus])

  const isChecked = status === "correct" || status === "incorrect"
  const hasInput = Object.keys(placed).length > 0
  const chipById = (id: string) => chips.find((chip) => chip.id === id)
  const pool = chips.filter((chip) => !placed[chip.id])
  const chipsIn = (zoneId: string) => chips.filter((chip) => placed[chip.id] === zoneId)

  function place(chipId: string, zoneId: string) {
    setPlaced((current) => ({ ...current, [chipId]: zoneId }))
    setStatus("unchecked")
  }

  /** returns the chip to the pool, wherever it sits */
  function unplace(chipId: string) {
    setPlaced((current) => {
      const next = { ...current }
      delete next[chipId]
      return next
    })
    setStatus("unchecked")
  }

  /** tapping a pool chip drops it into the first zone, no dragging needed */
  function placeInFirstZone(chipId: string) {
    const zone = state.zones[0]
    if (zone) place(chipId, zone.id)
  }

  function check() {
    const allCorrect = state.zones.every((zone) =>
      isZoneSolved(
        zone,
        chipsIn(zone.id).map((chip) => chip.text),
      ),
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
   * longer drags a ghost of the chip and drops it on the zone it is
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

  function renderZone(zone: DropZone, index: number) {
    const inside = chipsIn(zone.id)
    const isSolved = isZoneSolved(
      zone,
      inside.map((chip) => chip.text),
    )
    // a hidden zone gives nothing away: no outline, no hover feedback
    const isOver = drag?.over === zone.id && state.zonesVisible
    // `cn` does not merge classes, so every look sets its border on its own
    const frame = isChecked
      ? state.zonesVisible || !isSolved
        ? cn(
            "border-[3px] border-solid",
            isSolved ? statusBorder.correct : statusBorder.incorrect,
            state.zonesVisible &&
              (isSolved ? statusBackground.correct : statusBackground.incorrect),
          )
        : null
      : state.zonesVisible &&
        // the pale ring keeps the dark outline readable on a dark picture
        "border-[3px] border-dashed border-neutral-800/80 bg-white/10 ring-1 ring-white/60"
    return (
      <div
        key={zone.id}
        ref={(element) => {
          if (element) zoneRefs.current.set(zone.id, element)
          else zoneRefs.current.delete(zone.id)
        }}
        {...{ [DROP_ZONE_ATTRIBUTE]: zone.id }}
        aria-label={zone.title || `Zone ${index + 1}`}
        onClick={(event) => {
          event.stopPropagation()
          onHighlight({ type: "zone", id: zone.id })
        }}
        style={zoneStyle(zone)}
        className={cn(
          // a chip wider than its zone spills over the edge rather than
          // being cut off, so its answer stays readable
          "absolute flex flex-col rounded-lg transition-shadow",
          frame,
          isOver && "ring-2 ring-indigo-400 ring-offset-1",
        )}
      >
        {state.zonesVisible &&
          zone.title && (
            // the fill is faint now, so the title carries its own backdrop
            <span className="m-1 self-start whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-xs font-bold leading-tight text-neutral-800">
              {zone.title}
            </span>
          )}
        <div className="flex flex-wrap content-start gap-1 p-1">
          {inside.map((chip) => (
            <span
              key={chip.id}
              role="button"
              aria-label={`${chip.text} entfernen`}
              {...chipHandlers(chip, () => unplace(chip.id))}
              className={cn(
                chipStyle,
                "touch-none whitespace-nowrap bg-white px-2 text-sm",
                !isChecked && "cursor-grab",
                drag?.chipId === chip.id && "opacity-40",
              )}
            >
              {chip.text}
            </span>
          ))}
        </div>
      </div>
    )
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
                Drag & Drop Bild
                <HelpCircle className="h-4 w-4" />
              </div>

              <RichTextOutput
                ref={taskRef}
                html={state.task}
                placeholder="[Schreibe links eine Aufgabenstellung]"
                onClick={() => onHighlight({ type: "task" })}
                className="mb-8"
              />

              <Canvas
                ref={canvasRef}
                state={state}
                // leaves room for task and answer pool on the device screen
                maxHeight="42vh"
                onClick={() => onHighlight({ type: "canvas" })}
                className="scroll-mt-4 border border-neutral-200"
              >
                {state.zones.map(renderZone)}
                {state.zones.length === 0 && (
                  <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-xl leading-snug text-neutral-400">
                    [Zeichne links Ablagezonen auf das Bild]
                  </p>
                )}
              </Canvas>

              <div
                ref={poolRef}
                {...{ [DROP_ZONE_ATTRIBUTE]: POOL_ZONE }}
                onClick={() => onHighlight({ type: "extra-answers" })}
                className={cn(
                  "mt-6 flex min-h-[3.5rem] flex-wrap gap-3 rounded-lg py-1",
                  // a chip from a zone can be dropped back here
                  drag?.over === POOL_ZONE &&
                    !!placed[drag.chipId] &&
                    "-mx-2 px-2 ring-2 ring-indigo-300",
                )}
              >
                {pool.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    disabled={isChecked}
                    {...chipHandlers(chip, () => placeInFirstZone(chip.id))}
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
                    [Trage links Antworten in die Zonen ein]
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

/** id of the zone under the given point, if any */
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
