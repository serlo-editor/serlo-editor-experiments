export type ValidationStatus =
  | "unchecked"
  | "correct"
  | "incorrect"
  /** free text answer was handed in, there is nothing to check */
  | "submitted"
  /** answer was wrong and has been reset, waiting for a new selection */
  | "retry"

/** shared between the validation sheet and the selected answer in the preview */
export const statusBackground: Record<"correct" | "incorrect", string> = {
  correct: "bg-[#F1FCE9]",
  incorrect: "bg-[#FBF0E8]",
}

export const statusBorder: Record<"correct" | "incorrect", string> = {
  correct: "border-[#DCEFD0]",
  incorrect: "border-[#F0DDD1]",
}
