import { Root } from "./content"
import { bindDocument, type BoundDocument } from "./documents"
import { Answers, Feedback } from "./responses"
import { FlatNodeStore, ReadonlyNodeStore } from "./storage"

export type Mode = "authoring" | "answering" | "feedback" | "viewing"
export type Student = {
  id: string
  name: string
  answers: BoundDocument<typeof Answers>
  feedback: BoundDocument<typeof Feedback>
}
export type WorksheetDocuments = {
  mode: Mode
  content: BoundDocument<typeof Root>
  answers?: BoundDocument<typeof Answers>
  feedback?: BoundDocument<typeof Feedback>
}

/** Each student/attempt owns independent answer and feedback storage. */
export function createStudent(id: string, name: string): Student {
  return {
    id,
    name,
    answers: bindDocument(new FlatNodeStore(), Answers, {}),
    feedback: bindDocument(new FlatNodeStore(), Feedback, { overall: "", exercises: {} }),
  }
}

/** Snapshot read-only documents at mode entry; never rebind a writable root under another schema. */
export function createModeDocuments(
  mode: Mode,
  content: BoundDocument<typeof Root>,
  student: Student,
): WorksheetDocuments {
  if (mode === "authoring") return { mode, content }
  return {
    mode,
    content: bindDocument(new ReadonlyNodeStore(), Root, content.document.snapshot()),
    answers:
      mode === "answering"
        ? student.answers
        : bindDocument(new ReadonlyNodeStore(), Answers, student.answers.document.snapshot()),
    feedback:
      mode === "feedback"
        ? student.feedback
        : bindDocument(new ReadonlyNodeStore(), Feedback, student.feedback.document.snapshot()),
  }
}
