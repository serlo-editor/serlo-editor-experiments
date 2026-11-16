import { useSyncExternalStore } from "react"

import type { EditorSession } from "../editor"
import type { ContentValue } from "../editor/content"
import { DragAndDropBlanksPreview, FillInTheBlankPreview } from "./preview/blanks"
import { ChoicePreview } from "./preview/choice"
import { ImageDragAndDropPreview } from "./preview/image-drag-and-drop"
import { PreviewRichText } from "./preview/shared"
import { FreeTextPreview, TextInputPreview } from "./preview/text"

export function Preview({ session }: { session: EditorSession }) {
  useSyncExternalStore(
    session.store.subscribe.bind(session.store),
    session.store.getRevision.bind(session.store),
  )
  return (
    <div className="learner-content" aria-label="Lernvorschau">
      {session.root.map((value) => (
        <PreviewUnit key={value.id} value={value} />
      ))}
    </div>
  )
}

function PreviewUnit({ value }: { value: ContentValue }) {
  switch (value.type) {
    case "text":
      return <PreviewRichText handle={value.content} />
    case "single-choice":
      return <ChoicePreview handle={value} mode="single" />
    case "multiple-choice":
      return <ChoicePreview handle={value} mode="multiple" />
    case "text-input":
      return <TextInputPreview handle={value} />
    case "fill-in-the-blank":
      return <FillInTheBlankPreview handle={value} />
    case "drag-and-drop-blanks":
      return <DragAndDropBlanksPreview handle={value} />
    case "image-drag-and-drop":
      return <ImageDragAndDropPreview handle={value} />
    case "free-text":
      return <FreeTextPreview handle={value} />
  }
}
