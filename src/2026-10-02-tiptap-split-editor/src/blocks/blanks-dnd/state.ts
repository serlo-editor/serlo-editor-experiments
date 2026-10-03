import { normalizeAnswer } from "@/blocks/text-input/state"

export type { Highlight } from "@/blocks/highlight"

export interface BlanksDndState {
  task: string
  /**
   * HTML produced by the tiptap editor. Every blank is a
   * `<span data-blank="id" data-answer="…"></span>` element.
   */
  text: string
  /** answers that fit no blank, mixed into the pool to make it harder */
  extraAnswers: string[]
}

/** holds the id of the blank */
export const BLANK_ATTRIBUTE = "data-blank"
/** the one answer that belongs into the blank */
export const ANSWER_ATTRIBUTE = "data-answer"

export function readAnswer(element: Element) {
  return element.getAttribute(ANSWER_ATTRIBUTE) ?? ""
}

export function isAnswerCorrect(answer: string, input: string) {
  return !!answer && normalizeAnswer(answer) === normalizeAnswer(input)
}

export const initialBlanksDndState: BlanksDndState = {
  task: "<p>Ziehe die richtigen Antworten in die Lücken</p>",
  text: `<p>Im Korb liegen <span data-blank="trauben" data-answer="Trauben"></span>, <span data-blank="bananen" data-answer="Bananen"></span> und ein <span data-blank="apfel" data-answer="Apfel"></span>.</p>`,
  extraAnswers: ["Orange"],
}
