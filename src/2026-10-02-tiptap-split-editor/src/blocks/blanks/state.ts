import { normalizeAnswer } from "@/blocks/text-input/state"

export type { Highlight } from "@/blocks/highlight"

export interface BlanksState {
  task: string
  /**
   * HTML produced by the tiptap editor. Every blank is a
   * `<span data-blank="id" data-answers='["…"]'></span>` element.
   */
  text: string
}

/** holds the id of the blank */
export const BLANK_ATTRIBUTE = "data-blank"
/** JSON encoded list of valid answers */
export const ANSWERS_ATTRIBUTE = "data-answers"

export function readAnswers(element: Element): string[] {
  try {
    const parsed: unknown = JSON.parse(element.getAttribute(ANSWERS_ATTRIBUTE) ?? "[]")
    return Array.isArray(parsed)
      ? parsed.filter((answer): answer is string => typeof answer === "string")
      : []
  } catch {
    return []
  }
}

export function isBlankCorrect(answers: string[], input: string) {
  const normalized = normalizeAnswer(input)
  return answers.some((answer) => answer && normalizeAnswer(answer) === normalized)
}

export const initialBlanksState: BlanksState = {
  task: "<p>Tippe die richtigen Antworten in die Lücken</p>",
  text: `<p>Was soll in die <span data-blank="luecke" data-answers="[&quot;Lücke&quot;,&quot;Auslassung&quot;]"></span>?</p>`,
}
