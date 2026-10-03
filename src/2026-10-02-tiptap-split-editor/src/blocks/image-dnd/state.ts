import { normalizeAnswer } from "@/blocks/text-input/state"
import { createSimpleUID } from "@/utils/create-simple-uid"

export type { Highlight } from "@/blocks/highlight"

/** a rectangle on the picture, in percent of its width and height */
export interface DropZone {
  id: string
  /** shown on the zone, only when zones are visible */
  title: string
  x: number
  y: number
  width: number
  height: number
  /** every answer that belongs into this zone, all of them are expected */
  answers: string[]
}

export interface ImageDndState {
  task: string
  /** link to the picture, empty means a plain colored area instead */
  image: string
  /** background of the area when there is no picture */
  backgroundColor: string
  /** whether learners see where the zones are */
  zonesVisible: boolean
  zones: DropZone[]
  /** answers that fit no zone, mixed into the pool to make it harder */
  extraAnswers: string[]
}

/** aspect ratio of the colored area when there is no picture */
export const BLANK_CANVAS_RATIO = "4 / 3"

/** a zone this small is a slip of the pointer, not a zone */
export const MIN_ZONE_SIZE = 4

export function createDropZone(rect: Pick<DropZone, "x" | "y" | "width" | "height">): DropZone {
  return { id: createSimpleUID(), title: "", answers: [], ...rect }
}

export function isAnswerCorrect(answer: string, input: string) {
  return !!answer && normalizeAnswer(answer) === normalizeAnswer(input)
}

/** the zone is solved when exactly its answers are in it, no more, no less */
export function isZoneSolved(zone: DropZone, inputs: string[]) {
  const expected = zone.answers.map(normalizeAnswer).sort()
  const given = inputs.map(normalizeAnswer).sort()
  return (
    expected.length === given.length && expected.every((answer, index) => answer === given[index])
  )
}

/** inline style placing a zone on the canvas */
export function zoneStyle(
  zone: Pick<DropZone, "x" | "y" | "width" | "height">,
): React.CSSProperties {
  return {
    left: `${zone.x}%`,
    top: `${zone.y}%`,
    width: `${zone.width}%`,
    height: `${zone.height}%`,
  }
}

export const initialImageDndState: ImageDndState = {
  task: "<p>Wie heißen diese vier Planeten?</p>",
  image:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Solar_system.jpg/960px-Solar_system.jpg",
  backgroundColor: "#E8ECF8",
  zonesVisible: true,
  zones: [
    {
      id: "venus",
      title: "Planet 1",
      x: 23,
      y: 5,
      width: 19,
      height: 19,
      answers: ["Venus"],
    },
    {
      id: "erde",
      title: "Planet 2",
      x: 43,
      y: 13,
      width: 19,
      height: 16,
      answers: ["Erde"],
    },
    {
      id: "jupiter",
      title: "Planet 3",
      x: 60,
      y: 38,
      width: 32,
      height: 24,
      answers: ["Jupiter"],
    },
    {
      id: "neptun",
      title: "Planet 4",
      x: 14,
      y: 72,
      width: 23,
      height: 19,
      answers: ["Neptun"],
    },
  ],
  extraAnswers: ["Mond", "Sonne", "Pluto"],
}
