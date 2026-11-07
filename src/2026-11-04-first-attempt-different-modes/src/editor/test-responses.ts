import { bindDocument } from "./documents"
import { Answers, Feedback, feedbackText } from "./responses"
import { FlatNodeStore } from "./storage"
import type { ResponseDocuments } from "./worksheet"

export function createFlatResponses(): ResponseDocuments {
  return {
    answers: bindDocument(new FlatNodeStore(), Answers, {}),
    feedback: bindDocument(new FlatNodeStore(), Feedback, {
      overall: feedbackText(),
      exercises: {},
    }),
  }
}
