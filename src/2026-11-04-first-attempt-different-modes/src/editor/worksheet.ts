import { Root } from "./content"
import { bindDocument, bindReadonlyDocument, type BoundDocument } from "./documents"
import { gradeExercises } from "./grading"
import { Answers, Feedback, feedbackText } from "./responses"
import { FlatNodeStore } from "./storage"

export enum WorksheetMode {
  EditingContent = "editing-content",
  Answering = "answering",
  GivingFeedback = "giving-feedback",
  ViewingFeedback = "viewing-feedback",
}

export type Student = {
  id: string
  name: string
  answers: BoundDocument<typeof Answers>
  feedback: BoundDocument<typeof Feedback>
}
export type WorksheetDocuments = {
  mode: WorksheetMode
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

/** Run once per mode switch, before binding any peers; current and earlier data stay intact. */
export function clearFollowingDocuments(mode: WorksheetMode, student: Student) {
  if (mode === WorksheetMode.EditingContent) {
    const answers = student.answers.document.root
    for (const key of Object.keys(answers.snapshot())) answers.remove(key)
  }
  if (mode === WorksheetMode.EditingContent || mode === WorksheetMode.Answering) {
    const feedback = student.feedback.document.root
    const exercises = feedback.field("exercises")
    for (const key of Object.keys(exercises.snapshot())) exercises.remove(key)
    feedback.field("overall").getEditor().setContent(feedbackText())
  }
}

/** Keep locked documents live through read-only projections of their independent stores. */
export function createModeDocuments(
  mode: WorksheetMode,
  content: BoundDocument<typeof Root>,
  student: Student,
): WorksheetDocuments {
  if (mode === WorksheetMode.EditingContent) return { mode, content }
  if (mode === WorksheetMode.GivingFeedback) {
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
      mode === WorksheetMode.Answering
        ? student.answers
        : bindReadonlyDocument(student.answers, Answers),
    feedback:
      mode === WorksheetMode.GivingFeedback
        ? student.feedback
        : bindReadonlyDocument(student.feedback, Feedback),
  }
}
