import { BadgeHelp, Image as ImageIcon, MousePointerClick, Trash2, Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { RichTextEditor } from "@/components/rich-text-editor"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/utils/cn"

import { AnswerList } from "./answer-list"
import { Canvas } from "./canvas"
import {
  MIN_ZONE_SIZE,
  zoneStyle,
  createDropZone,
  type DropZone,
  type Highlight,
  type ImageDndState,
} from "./state"

const highlightRing = "ring-2 ring-indigo-300 ring-offset-2"

type Rect = Pick<DropZone, "x" | "y" | "width" | "height">

/** what the pointer is doing on the canvas */
type Gesture =
  | { kind: "draw"; startX: number; startY: number; rect: Rect }
  | { kind: "move"; id: string; grabX: number; grabY: number; start: Rect }
  | { kind: "resize"; id: string; start: Rect }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** rectangle spanned by two points, kept inside the canvas */
function spanRect(x1: number, y1: number, x2: number, y2: number): Rect {
  const x = clamp(Math.min(x1, x2), 0, 100)
  const y = clamp(Math.min(y1, y2), 0, 100)
  return {
    x,
    y,
    width: clamp(Math.max(x1, x2), 0, 100) - x,
    height: clamp(Math.max(y1, y2), 0, 100) - y,
  }
}

const round = (value: number) => Math.round(value * 10) / 10

export function ImageDndEditor({
  state,
  onChange,
  highlight,
  onFocus,
}: {
  state: ImageDndState
  onChange: (state: ImageDndState) => void
  highlight: Highlight
  /** called when a field gets focus, so the preview can follow along */
  onFocus: (target: Highlight) => void
}) {
  const taskRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const extraRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(state.zones[0]?.id ?? null)
  const [gesture, setGesture] = useState<Gesture | null>(null)

  useEffect(() => {
    if (!highlight) return
    // the panel of a zone only exists once that zone is selected, so
    // selecting it first lets the next run scroll to it
    if (highlight.type === "zone" && highlight.id !== selected) {
      setSelected(highlight.id)
      return
    }
    let element: HTMLElement | null = null
    if (highlight.type === "task") element = taskRef.current
    if (highlight.type === "canvas") element = canvasRef.current
    if (highlight.type === "extra-answers") element = extraRef.current
    if (highlight.type === "zone") element = panelRef.current
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [highlight, selected])

  const update = (patch: Partial<ImageDndState>) => onChange({ ...state, ...patch })

  function updateZone(id: string, patch: Partial<DropZone>) {
    update({
      zones: state.zones.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)),
    })
  }

  function removeZone(id: string) {
    update({ zones: state.zones.filter((zone) => zone.id !== id) })
    if (selected === id) setSelected(null)
  }

  function selectZone(id: string) {
    setSelected(id)
    onFocus({ type: "zone", id })
  }

  /** pointer position in percent of the canvas */
  function pointOf(event: PointerEvent | React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    }
  }

  function startGesture(event: React.PointerEvent<HTMLElement>, initial: Gesture) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(event.pointerId)
    let current = initial
    setGesture(current)

    const onMove = (move: PointerEvent) => {
      const point = pointOf(move)
      if (current.kind === "draw") {
        current = {
          ...current,
          rect: spanRect(current.startX, current.startY, point.x, point.y),
        }
        setGesture(current)
      } else if (current.kind === "move") {
        const { start } = current
        updateZone(current.id, {
          x: round(clamp(point.x - current.grabX, 0, 100 - start.width)),
          y: round(clamp(point.y - current.grabY, 0, 100 - start.height)),
        })
      } else {
        const { start } = current
        updateZone(current.id, {
          width: round(Math.max(MIN_ZONE_SIZE, point.x - start.x)),
          height: round(Math.max(MIN_ZONE_SIZE, point.y - start.y)),
        })
      }
    }
    const onEnd = () => {
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onEnd)
      canvas.removeEventListener("pointercancel", onEnd)
      setGesture(null)
      if (current.kind !== "draw") return
      const { rect } = current
      if (rect.width < MIN_ZONE_SIZE || rect.height < MIN_ZONE_SIZE) {
        setSelected(null)
        return
      }
      const zone = createDropZone({
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.width),
        height: round(rect.height),
      })
      update({ zones: [...state.zones, zone] })
      selectZone(zone.id)
    }
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onEnd)
    canvas.addEventListener("pointercancel", onEnd)
  }

  function onCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    onFocus({ type: "canvas" })
    const { x, y } = pointOf(event)
    startGesture(event, {
      kind: "draw",
      startX: x,
      startY: y,
      rect: { x, y, width: 0, height: 0 },
    })
  }

  function onZonePointerDown(event: React.PointerEvent<HTMLElement>, zone: DropZone) {
    selectZone(zone.id)
    const point = pointOf(event)
    startGesture(event, {
      kind: "move",
      id: zone.id,
      grabX: point.x - zone.x,
      grabY: point.y - zone.y,
      start: zone,
    })
  }

  function onHandlePointerDown(event: React.PointerEvent<HTMLElement>, zone: DropZone) {
    selectZone(zone.id)
    startGesture(event, { kind: "resize", id: zone.id, start: zone })
  }

  function uploadImage(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") update({ image: reader.result })
    }
    reader.readAsDataURL(file)
  }

  const isDrawing = gesture?.kind === "draw"

  return (
    <div className="mx-auto max-w-3xl px-8 pb-20 pt-16">
      <div className="mb-7 flex items-center justify-start gap-2 text-[#8F9AD6]">
        <span className="text-base">Drag & Drop Bild</span>
        <BadgeHelp className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <label htmlFor="id-task" className="mb-3 block text-lg font-bold text-neutral-800">
        Aufgabenstellung
      </label>
      <div onFocusCapture={() => onFocus({ type: "task" })}>
        <RichTextEditor
          id="id-task"
          ref={taskRef}
          value={state.task}
          onChange={(task) => update({ task })}
          placeholder="z.B. eine Anweisung"
          className={cn("mb-12 scroll-mt-24", highlight?.type === "task" && highlightRing)}
        />
      </div>

      <h3 className="mb-1 text-lg font-bold text-neutral-800">Bild</h3>
      <p className="mb-3 text-sm text-neutral-500">
        Am besten eignen sich möglichst quadratische Bilder. Sehr breite oder hohe Bilder lassen
        wenig Platz für die Ablagezonen.
      </p>
      <div
        className="mb-6 flex flex-wrap items-center gap-2"
        onFocusCapture={() => onFocus({ type: "canvas" })}
      >
        <div className="relative min-w-64 flex-1">
          <ImageIcon
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
            strokeWidth={1.75}
          />
          <input
            id="id-image"
            type="text"
            value={state.image.startsWith("data:") ? "" : state.image}
            onChange={(event) => update({ image: event.target.value.trim() })}
            placeholder={
              state.image.startsWith("data:") ? "Hochgeladenes Bild" : "https://…/bild.jpg"
            }
            className="w-full rounded-lg border border-neutral-200 py-3 pl-10 pr-3 text-base ring-offset-white placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-3 py-3 text-base text-neutral-800 transition-colors hover:bg-neutral-50">
          <Upload className="h-5 w-5 text-indigo-500" strokeWidth={1.75} />
          Hochladen
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              uploadImage(event.target.files?.[0])
              event.target.value = ""
            }}
          />
        </label>
        {state.image && (
          <button
            type="button"
            onClick={() => update({ image: "" })}
            className="flex items-center gap-2 rounded-lg px-3 py-3 text-base text-neutral-800 transition-colors hover:bg-neutral-50"
          >
            <Trash2 className="h-5 w-5 text-neutral-500" strokeWidth={1.75} />
            Entfernen
          </button>
        )}
      </div>

      {!state.image && (
        <div className="mb-6 flex items-center gap-3">
          <label htmlFor="id-color" className="text-base font-bold text-neutral-800">
            Hintergrundfarbe
          </label>
          <input
            id="id-color"
            type="color"
            value={state.backgroundColor}
            onChange={(event) => update({ backgroundColor: event.target.value })}
            className="h-10 w-14 cursor-pointer rounded-lg border border-neutral-200 bg-white p-1"
          />
          <span className="text-sm text-neutral-500">Wird ohne Bild als Fläche verwendet.</span>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-neutral-800">Ablagezonen</h3>
        <label className="flex items-center gap-3 text-base text-neutral-800">
          Zonen für Lernende sichtbar
          <Switch
            checked={state.zonesVisible}
            onCheckedChange={(zonesVisible) => update({ zonesVisible })}
          />
        </label>
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        Ziehe mit der Maus über das Bild, um eine Zone zu erstellen. Zonen lassen sich verschieben
        und an der Ecke vergrößern.
      </p>

      {/* the frame shows where the picture ends when it is narrower than the
          column, e.g. a portrait one capped by `maxHeight` */}
      <div className="rounded-xl bg-neutral-100 p-2">
        <Canvas
          ref={canvasRef}
          state={state}
          maxHeight="20rem"
          onPointerDown={onCanvasPointerDown}
          className={cn(
            "mx-auto scroll-mt-24 cursor-crosshair touch-none",
            highlight?.type === "canvas" && highlightRing,
          )}
        >
          {state.zones.map((zone, index) => {
            const isSelected = selected === zone.id
            return (
              <div
                key={zone.id}
                role="button"
                tabIndex={0}
                aria-label={zone.title || `Zone ${index + 1}`}
                style={zoneStyle(zone)}
                onPointerDown={(event) => onZonePointerDown(event, zone)}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" || event.key === "Delete") removeZone(zone.id)
                }}
                onFocus={() => selectZone(zone.id)}
                className={cn(
                  "absolute cursor-move rounded-md border-2 bg-indigo-400/20 focus-visible:outline-none",
                  isSelected
                    ? "border-indigo-500 bg-indigo-400/30 shadow-md"
                    : "border-indigo-400 border-dashed",
                )}
              >
                <span className="absolute left-1 top-1 whitespace-nowrap rounded bg-white/90 px-1 py-0.5 text-[11px] font-bold leading-tight text-neutral-800">
                  {zone.title || index + 1}
                </span>
                <span
                  aria-label="Größe ändern"
                  onPointerDown={(event) => onHandlePointerDown(event, zone)}
                  className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-indigo-500 bg-white"
                />
              </div>
            )
          })}
          {isDrawing && (
            <div
              aria-hidden
              style={zoneStyle(gesture.rect)}
              className="absolute rounded-md border-2 border-dashed border-indigo-500 bg-indigo-400/30"
            />
          )}
        </Canvas>
      </div>

      {(() => {
        const index = state.zones.findIndex((zone) => zone.id === selected)
        const zone = state.zones[index]

        if (!zone)
          return (
            <p className="mt-4 text-sm text-neutral-500">
              {state.zones.length === 0
                ? "Noch keine Zonen. Ziehe ein Rechteck über das Bild."
                : "Wähle eine Zone im Bild aus, um ihre Antworten zu bearbeiten."}
            </p>
          )

        return (
          // only the selected zone is edited, so the hint says where the
          // settings below come from
          <>
            <p className="mt-4 flex items-center gap-1.5 text-sm text-neutral-500">
              <MousePointerClick className="h-4 w-4 shrink-0 text-indigo-500" strokeWidth={1.75} />
              Klicke eine Zone im Bild an, um ihre Antworten zu bearbeiten.
            </p>
            <div
              ref={panelRef}
              onFocusCapture={() => onFocus({ type: "zone", id: zone.id })}
              className={cn(
                "mt-6 scroll-mt-24 rounded-xl border border-indigo-300 bg-indigo-50/40 p-5",
                highlight?.type === "zone" && highlight.id === zone.id && highlightRing,
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {index + 1}
                </span>
                {state.zonesVisible ? (
                  <input
                    aria-label={`Titel von Zone ${index + 1}`}
                    value={zone.title}
                    onChange={(event) => updateZone(zone.id, { title: event.target.value })}
                    placeholder="Titel der Zone (optional)"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-base font-bold ring-offset-white placeholder:font-normal placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                  />
                ) : (
                  <span className="flex-1 text-base text-neutral-500">Versteckte Zone</span>
                )}
                <button
                  type="button"
                  aria-label={`Zone ${index + 1} löschen`}
                  onClick={() => removeZone(zone.id)}
                  className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                >
                  <Trash2 className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
              <label
                htmlFor={`id-zone-${zone.id}`}
                className="mb-2 block text-sm font-bold text-neutral-800"
              >
                Richtige Antworten
              </label>
              <AnswerList
                id={`id-zone-${zone.id}`}
                size="sm"
                answers={zone.answers}
                onChange={(answers) => updateZone(zone.id, { answers })}
                placeholder="Eine Antwort für diese Zone"
                emptyLabel="Noch keine Antworten. Alle Antworten müssen in die Zone gezogen werden."
              />
            </div>
          </>
        )
      })()}

      <div
        ref={extraRef}
        onFocusCapture={() => onFocus({ type: "extra-answers" })}
        className={cn(
          "mt-10 scroll-mt-24 rounded-xl border border-neutral-200 p-6",
          highlight?.type === "extra-answers" && highlightRing,
        )}
      >
        <h3 className="mb-1 text-lg font-bold text-neutral-800">Falsche Antworten</h3>
        <p className="mb-4 text-sm text-neutral-500">
          Zusätzliche Antworten, die in keine Zone passen. Sie werden mit den richtigen Antworten
          gemischt angeboten.
        </p>
        <AnswerList
          id="id-extra"
          answers={state.extraAnswers}
          onChange={(extraAnswers) => update({ extraAnswers })}
          placeholder="Eine falsche Antwort"
          emptyLabel="Noch keine falschen Antworten."
        />
      </div>
    </div>
  )
}
