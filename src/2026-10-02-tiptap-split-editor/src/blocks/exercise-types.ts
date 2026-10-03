export const exerciseTypes = [
  { id: "single-choice", label: "Single Choice" },
  { id: "text-input", label: "Texteingabe" },
  { id: "blanks", label: "Lückentext" },
  { id: "blanks-dnd", label: "Lückentext (Drag & Drop)" },
  { id: "image-dnd", label: "Drag & Drop Bild" },
  { id: "free-text", label: "Freitext" },
] as const

export type ExerciseType = (typeof exerciseTypes)[number]["id"]
