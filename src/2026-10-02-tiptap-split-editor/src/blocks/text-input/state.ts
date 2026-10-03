import { createSimpleUID } from "@/utils/create-simple-uid"

export type { Highlight } from "@/blocks/highlight"

export interface TextAnswer {
  id: string
  text: string
}

export interface TextInputState {
  task: string
  /** every listed answer is accepted as correct */
  answers: TextAnswer[]
}

export function createTextAnswer(text = ""): TextAnswer {
  return { id: createSimpleUID(), text }
}

/** whitespace and case are irrelevant when comparing learner input */
export function normalizeAnswer(text: string) {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("de")
}

export const initialTextInputState: TextInputState = {
  task: "<p>Wie heißt die Blaubeere noch?</p>",
  answers: [createTextAnswer("Heidelbeere"), createTextAnswer("Bickbeere")],
}
