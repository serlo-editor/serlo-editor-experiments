export type { Highlight } from "@/blocks/highlight"

export interface FreeTextState {
  task: string
  /** learners can only submit once their answer is at least this long */
  minLength: number
}

export const initialFreeTextState: FreeTextState = {
  task: "<p>Wie war dein Tag heute?</p>",
  minLength: 50,
}

/** trailing whitespace should not count towards the minimum */
export function answerLength(text: string) {
  return text.trim().length
}

/** how many characters are still missing, 0 once the minimum is reached */
export function missingCharacters(text: string, minLength: number) {
  return Math.max(0, minLength - answerLength(text))
}
