import { Trash2 } from "lucide-react"
import { type PointerEvent, useRef, useState } from "react"

import { ExerciseBadge } from "../components/ExerciseBadge"
import { array, boolean, number, object, richText, string, unit } from "../schema"
import type { ObjectHandle } from "../schema/object"
import {
  AddButton,
  AnswerRow,
  answerDefinition,
  emptyInlineText,
  ExtraAnswersPanel,
  FieldLabel,
  insertAndFocus,
  removeAndFocus,
  TaskField,
  taskDefinition,
} from "./shared"

/** a rectangle on the picture, in percent of its width and height */
const zoneFields = {
  id: string(),
  /** shown on the zone, only when zones are visible */
  title: string(),
  x: number(),
  y: number(),
  width: number(),
  height: number(),
  /** every answer that belongs into this zone, all of them are expected */
  answers: array(richText({ definition: answerDefinition })),
}

const imageFields = {
  task: richText({ definition: taskDefinition }),
  /** link to the picture, empty means a plain colored area instead */
  image: string(),
  /** whether learners see where the zones are */
  zonesVisible: boolean(),
  zones: array(object(zoneFields)),
  /** answers that fit no zone, mixed into the pool to make it harder */
  extraAnswers: array(string()),
}

export const ImageDragAndDrop = unit({
  type: "image-drag-and-drop",
  fields: imageFields,
  render: ({ handle }) => <ImageDragAndDropEditor handle={handle} />,
})

export type ZoneHandle = ObjectHandle<typeof zoneFields>
export type Rect = { x: number; y: number; width: number; height: number }

/** a zone this small is a slip of the pointer, not a zone */
const MIN_ZONE_SIZE = 4

function ImageDragAndDropEditor({ handle }: { handle: ObjectHandle<typeof imageFields> }) {
  const image = handle.field("image")
  const zonesVisible = handle.field("zonesVisible")
  const zones = handle.field("zones")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIndex = zones.children().findIndex((zone) => zone.field("id").get() === selectedId)
  const selected = zones.children()[selectedIndex]

  return (
    <div className="exercise">
      <ExerciseBadge label="Drag & Drop Bild" help="Lernende ziehen Antworten auf Zonen im Bild." />
      <TaskField handle={handle.field("task")} />

      <FieldLabel hint="Link zu einem Bild. Ohne Bild wird eine leere Fläche verwendet.">
        Bild
      </FieldLabel>
      <input
        type="url"
        className="text-input"
        aria-label="Link zum Bild"
        placeholder="https://…"
        value={image.get()}
        onChange={(event) => image.set(event.currentTarget.value)}
      />

      <FieldLabel hint="Ziehe auf dem Bild, um eine Zone anzulegen. Ziehe eine Zone, um sie zu verschieben.">
        Ablagezonen
      </FieldLabel>
      <label className="toggle">
        <input
          type="checkbox"
          checked={zonesVisible.get()}
          onChange={(event) => zonesVisible.set(event.currentTarget.checked)}
        />
        Zonen für Lernende sichtbar
      </label>
      <ZoneCanvas
        image={image.get()}
        zones={zones.children()}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={(rect) => {
          const id = crypto.randomUUID()
          zones.insert(zones.length, { id, title: "", ...rect, answers: [emptyInlineText] })
          setSelectedId(id)
        }}
      />
      {selected ? (
        <ZonePanel
          key={selected.field("id").get()}
          zone={selected}
          number={selectedIndex + 1}
          onRemove={() => {
            zones.remove(selectedIndex)
            setSelectedId(null)
          }}
        />
      ) : (
        <p className="exercise__hint">Wähle eine Zone aus, um ihre Antworten zu bearbeiten.</p>
      )}

      <ExtraAnswersPanel
        answers={handle.field("extraAnswers")}
        hint="Zusätzliche Antworten, die in keine Zone passen. Sie werden mit den richtigen Antworten gemischt angeboten."
      />
    </div>
  )
}

/** what the pointer is doing on the canvas */
type Gesture =
  | { kind: "draw"; startX: number; startY: number; rect: Rect }
  | { kind: "move"; index: number; grabX: number; grabY: number; rect: Rect }

function ZoneCanvas({
  image,
  zones,
  selectedId,
  onSelect,
  onCreate,
}: {
  image: string
  zones: ZoneHandle[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: (rect: Rect) => void
}) {
  const canvas = useRef<HTMLDivElement>(null)
  const [gesture, setGesture] = useState<Gesture | null>(null)

  /** pointer position in percent of the canvas */
  const pointAt = (event: PointerEvent) => {
    const bounds = canvas.current?.getBoundingClientRect()
    if (!bounds) return { x: 0, y: 0 }
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100),
    }
  }

  const capture = (event: PointerEvent) => {
    canvas.current?.setPointerCapture(event.pointerId)
  }

  function startDraw(event: PointerEvent) {
    if (event.button !== 0) return
    capture(event)
    const { x, y } = pointAt(event)
    onSelect(null)
    setGesture({ kind: "draw", startX: x, startY: y, rect: { x, y, width: 0, height: 0 } })
  }

  function startMove(event: PointerEvent, index: number, zone: ZoneHandle) {
    if (event.button !== 0) return
    event.stopPropagation()
    capture(event)
    const { x, y } = pointAt(event)
    const rect = zoneRect(zone)
    onSelect(zone.field("id").get())
    setGesture({ kind: "move", index, grabX: x - rect.x, grabY: y - rect.y, rect })
  }

  function update(event: PointerEvent) {
    if (!gesture) return
    const { x, y } = pointAt(event)
    if (gesture.kind === "draw") {
      setGesture({ ...gesture, rect: spanRect(gesture.startX, gesture.startY, x, y) })
    } else {
      const { width, height } = gesture.rect
      setGesture({
        ...gesture,
        rect: {
          x: clamp(x - gesture.grabX, 0, 100 - width),
          y: clamp(y - gesture.grabY, 0, 100 - height),
          width,
          height,
        },
      })
    }
  }

  function finish() {
    if (gesture?.kind === "draw") {
      const { rect } = gesture
      if (rect.width >= MIN_ZONE_SIZE && rect.height >= MIN_ZONE_SIZE) onCreate(roundRect(rect))
    } else if (gesture?.kind === "move") {
      const zone = zones[gesture.index]
      const rect = roundRect(gesture.rect)
      zone?.field("x").set(rect.x)
      zone?.field("y").set(rect.y)
    }
    setGesture(null)
  }

  return (
    <div
      ref={canvas}
      className="zone-canvas zone-canvas--editor"
      onPointerDown={startDraw}
      onPointerMove={update}
      onPointerUp={finish}
      onPointerCancel={() => setGesture(null)}
    >
      {image ? (
        <img className="zone-canvas__image" src={image} alt="" draggable={false} />
      ) : (
        <div className="zone-canvas__blank" />
      )}
      {zones.map((zone, index) => {
        const id = zone.field("id").get()
        const rect =
          gesture?.kind === "move" && gesture.index === index ? gesture.rect : zoneRect(zone)
        return (
          <div
            key={id}
            className={id === selectedId ? "zone zone--selected" : "zone"}
            style={zoneStyle(rect)}
            onPointerDown={(event) => startMove(event, index, zone)}
          >
            <span className="zone__label">
              {index + 1}
              {zone.field("title").get() ? ` · ${zone.field("title").get()}` : ""}
            </span>
          </div>
        )
      })}
      {gesture?.kind === "draw" ? (
        <div className="zone zone--draft" style={zoneStyle(gesture.rect)} />
      ) : null}
    </div>
  )
}

function ZonePanel({
  zone,
  number,
  onRemove,
}: {
  zone: ZoneHandle
  number: number
  onRemove: () => void
}) {
  const title = zone.field("title")
  const answers = zone.field("answers")
  const addAnswer = (index: number) =>
    insertAndFocus(answers, index, emptyInlineText, (answer) => answer)

  return (
    <div className="zone-panel">
      <div className="zone-panel__header">
        <span className="zone-panel__number">{number}</span>
        <input
          className="text-input"
          aria-label="Titel der Zone"
          placeholder="Titel der Zone (optional)"
          value={title.get()}
          onChange={(event) => title.set(event.currentTarget.value)}
        />
        <button
          type="button"
          className="answer-input__remove"
          aria-label="Zone löschen"
          title="Zone löschen"
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>
      <p className="zone-panel__label">Richtige Antworten für diese Zone</p>
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
      <AddButton onClick={() => addAnswer(answers.length)}>Antwort hinzufügen</AddButton>
    </div>
  )
}

export function zoneRect(zone: ZoneHandle): Rect {
  return {
    x: zone.field("x").get(),
    y: zone.field("y").get(),
    width: zone.field("width").get(),
    height: zone.field("height").get(),
  }
}

/** inline style placing a zone on the canvas */
export function zoneStyle(rect: Rect) {
  return {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
  }
}

/** rectangle spanned by two points */
function spanRect(x1: number, y1: number, x2: number, y2: number): Rect {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  return { x, y, width: Math.max(x1, x2) - x, height: Math.max(y1, y2) - y }
}

function roundRect({ x, y, width, height }: Rect): Rect {
  const round = (value: number) => Math.round(value * 10) / 10
  return { x: round(x), y: round(y), width: round(width), height: round(height) }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
