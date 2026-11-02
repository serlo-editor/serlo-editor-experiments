import {
  DragAndDropBlanks,
  FillInTheBlank,
  FreeText,
  ImageDragAndDrop,
  MultipleChoice,
  type RootSnapshot,
  SingleChoice,
  TextInput,
} from "../editor/content"
import type { RichTextJSON } from "../editor/rich-text"

export const exerciseTypes = [
  {
    id: "single-choice",
    label: "Single Choice",
    content: [
      SingleChoice.createUnit({
        task: paragraph("Welche Beere heißt auch Bärentraube?"),
        options: [
          { isCorrect: true, text: inline("Bearberries") },
          { isCorrect: false, text: inline("Wolfberries") },
          { isCorrect: false, text: inline("Catberries") },
        ],
      }),
    ],
  },
  {
    id: "multiple-choice",
    label: "Multiple Choice",
    content: [
      MultipleChoice.createUnit({
        task: paragraph("Welche Zahlen sind gerade?"),
        options: [
          { isCorrect: false, text: inline("3") },
          { isCorrect: true, text: inline("4") },
          { isCorrect: true, text: inline("6") },
        ],
      }),
    ],
  },
  {
    id: "text-input",
    label: "Texteingabe",
    content: [
      TextInput.createUnit({
        task: paragraph("Wie heißt die Blaubeere noch?"),
        answers: [inline("Heidelbeere"), inline("Bickbeere")],
      }),
    ],
  },
  {
    id: "fill-in-the-blank",
    label: "Lückentext",
    content: [
      FillInTheBlank.createUnit({
        content: paragraph("Die Hauptstadt von Frankreich ist ", gap("Paris"), "."),
      }),
    ],
  },
  {
    id: "drag-and-drop-blanks",
    label: "Lückentext (Drag & Drop)",
    content: [
      DragAndDropBlanks.createUnit({
        content: paragraph(
          "Im Korb liegen ",
          gap("Trauben"),
          ", ",
          gap("Bananen"),
          " und ein ",
          gap("Apfel"),
          ".",
        ),
        extraAnswers: ["Orange"],
      }),
    ],
  },
  {
    id: "image-drag-and-drop",
    label: "Drag & Drop Bild",
    content: [
      ImageDragAndDrop.createUnit({
        task: paragraph("Wie heißen diese vier Planeten?"),
        image:
          "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Solar_system.jpg/960px-Solar_system.jpg",
        zonesVisible: true,
        zones: [
          zone("venus", "Planet 1", { x: 23, y: 5, width: 19, height: 19 }, "Venus"),
          zone("erde", "Planet 2", { x: 43, y: 13, width: 19, height: 16 }, "Erde"),
          zone("jupiter", "Planet 3", { x: 60, y: 38, width: 32, height: 24 }, "Jupiter"),
          zone("neptun", "Planet 4", { x: 14, y: 72, width: 23, height: 19 }, "Neptun"),
        ],
        extraAnswers: ["Mond", "Sonne", "Pluto"],
      }),
    ],
  },
  {
    id: "free-text",
    label: "Freitext",
    content: [FreeText.createUnit({ task: paragraph("Wie war dein Tag heute?"), minLength: 50 })],
  },
] as const satisfies readonly { id: string; label: string; content: RootSnapshot }[]

export type ExerciseType = (typeof exerciseTypes)[number]["id"]

function inline(text: string): RichTextJSON {
  return { type: "doc", content: [{ type: "inlineBlock", content: [{ type: "text", text }] }] }
}

function paragraph(...parts: (string | RichTextJSON)[]): RichTextJSON {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: parts.map((part) =>
          typeof part === "string" ? { type: "text", text: part } : part,
        ),
      },
    ],
  }
}

function gap(text: string): RichTextJSON {
  return { type: "text", text, marks: [{ type: "gap" }] }
}

function zone(
  id: string,
  title: string,
  rect: { x: number; y: number; width: number; height: number },
  answer: string,
) {
  return { id, title, ...rect, answers: [inline(answer)] }
}
