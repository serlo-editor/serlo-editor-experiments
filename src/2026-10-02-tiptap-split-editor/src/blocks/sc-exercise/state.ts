import { createSimpleUID } from "@/utils/create-simple-uid"

export type { Highlight } from "@/blocks/highlight"

export interface Answer {
  id: string
  text: string
  isCorrect: boolean
}

export interface SingleChoiceState {
  task: string
  answers: Answer[]
}

export function createAnswer(text = "", isCorrect = false): Answer {
  return { id: createSimpleUID(), text, isCorrect }
}

export const initialSingleChoiceState: SingleChoiceState = {
  task: "",
  answers: [
    createAnswer("Bearberries", true),
    createAnswer("Wolfberries", false),
    createAnswer("Catberries", false),
  ],
}
