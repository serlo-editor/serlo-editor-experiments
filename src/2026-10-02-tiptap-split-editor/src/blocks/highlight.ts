/**
 * A field of an exercise. Used in both directions: the preview highlights a
 * field in the editor, and the editor scrolls the preview to a field.
 */
export type Highlight =
  | { type: "task" }
  | { type: "answer"; id: string }
  /** the minimal answer length of a free text exercise */
  | { type: "min-length" }
  /** the text with blanks of a blanks exercise */
  | { type: "text" }
  | { type: "blank"; id: string }
  /** the wrong answers of a drag & drop blanks exercise (its answer pool) */
  | { type: "extra-answers" }
  /** the picture with drop zones of an image drag & drop exercise */
  | { type: "canvas" }
  | { type: "zone"; id: string }
  | null
