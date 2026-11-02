import type { EditorSession } from "../editor"
import type { ContentHandle } from "../editor/content"
import { useStorage } from "../editor/use-storage"
import { DragAndDropBlanksPreview, FillInTheBlankPreview } from "./preview/blanks"
import { ChoicePreview } from "./preview/choice"
import { ImageDragAndDropPreview } from "./preview/image-drag-and-drop"
import { PreviewRichText } from "./preview/shared"
import { FreeTextPreview, TextInputPreview } from "./preview/text"

export function Preview({ session }: { session: EditorSession }) {
  useStorage(session.store)
  return (
    <div className="learner-content" aria-label="Lernvorschau">
      {session.document.root.map((handle) => (
        <PreviewUnit key={handle.id} handle={handle} />
      ))}
    </div>
  )
}

function PreviewUnit({ handle }: { handle: ContentHandle }) {
  switch (handle.type) {
    case "text":
      return <PreviewRichText handle={handle.field("content")} />
    case "single-choice":
      return <ChoicePreview handle={handle} mode="single" />
    case "multiple-choice":
      return <ChoicePreview handle={handle} mode="multiple" />
    case "text-input":
      return <TextInputPreview handle={handle} />
    case "fill-in-the-blank":
      return <FillInTheBlankPreview handle={handle} />
    case "drag-and-drop-blanks":
      return <DragAndDropBlanksPreview handle={handle} />
    case "image-drag-and-drop":
      return <ImageDragAndDropPreview handle={handle} />
    case "free-text":
      return <FreeTextPreview handle={handle} />
  }
}
