import { Root } from "./content"
import { bindDocument, bindReadonlyDocument, type BoundDocument } from "./documents"
import { gradeExercises } from "./grading"
import { Answers, Feedback, feedbackText } from "./responses"
import { FlatNodeStore } from "./storage"

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
export function createStudent(
  id: string,
  name: string,
  documents: Pick<Student, "answers" | "feedback"> = {
    answers: bindDocument(new FlatNodeStore(), Answers, {}),
    feedback: bindDocument(new FlatNodeStore(), Feedback, {
      overall: feedbackText(),
      exercises: {},
    }),
  },
): Student {
  return { id, name, ...documents }
}

/** Keep locked documents live through read-only projections of their independent stores. */
export function createModeDocuments(
  mode: Mode,
  content: BoundDocument<typeof Root>,
  student: Student,
): WorksheetDocuments {
  if (mode === "authoring") return { mode, content }
  if (mode === "feedback") {
    gradeExercises(
      content.document.root,
      student.answers.document.root,
      student.feedback.document.root,
    )
  }
  return {
    mode,
    content: bindReadonlyDocument(content, Root),
    answers:
      mode === "answering" ? student.answers : bindReadonlyDocument(student.answers, Answers),
    feedback:
      mode === "feedback" ? student.feedback : bindReadonlyDocument(student.feedback, Feedback),
  }
}
