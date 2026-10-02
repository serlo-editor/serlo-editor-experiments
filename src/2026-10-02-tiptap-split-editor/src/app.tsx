import { Fragment, useState } from "react"

import { BlanksDndEditor } from "@/blocks/blanks-dnd/blanks-dnd-editor"
import { BlanksDndPreview } from "@/blocks/blanks-dnd/blanks-dnd-preview"
import { initialBlanksDndState, type BlanksDndState } from "@/blocks/blanks-dnd/state"
import { BlanksEditor } from "@/blocks/blanks/blanks-editor"
import { BlanksPreview } from "@/blocks/blanks/blanks-preview"
import { initialBlanksState, type BlanksState } from "@/blocks/blanks/state"
import type { ExerciseType } from "@/blocks/exercise-types"
import { FreeTextEditor } from "@/blocks/free-text/free-text-editor"
import { FreeTextPreview } from "@/blocks/free-text/free-text-preview"
import { initialFreeTextState, type FreeTextState } from "@/blocks/free-text/state"
import type { Highlight } from "@/blocks/highlight"
import { ImageDndEditor } from "@/blocks/image-dnd/image-dnd-editor"
import { ImageDndPreview } from "@/blocks/image-dnd/image-dnd-preview"
import { initialImageDndState, type ImageDndState } from "@/blocks/image-dnd/state"
import { SingleChoiceEditor } from "@/blocks/sc-exercise/single-choice-editor"
import { SingleChoicePreview } from "@/blocks/sc-exercise/single-choice-preview"
import { initialSingleChoiceState, type SingleChoiceState } from "@/blocks/sc-exercise/state"
import { initialTextInputState, type TextInputState } from "@/blocks/text-input/state"
import { TextInputEditor } from "@/blocks/text-input/text-input-editor"
import { TextInputPreview } from "@/blocks/text-input/text-input-preview"
import { ExerciseTypeBar } from "@/components/exercise-type-bar"
import { SplitPane } from "@/components/split-pane"
import { ARROW_NAV_ATTRIBUTE, handleArrowKeyNavigation } from "@/utils/arrow-key-navigation"

export function App() {
  const [exerciseType, setExerciseType] = useState<ExerciseType>("single-choice")
  const [singleChoice, setSingleChoice] = useState<SingleChoiceState>(initialSingleChoiceState)
  const [textInput, setTextInput] = useState<TextInputState>(initialTextInputState)
  const [blanks, setBlanks] = useState<BlanksState>(initialBlanksState)
  const [blanksDnd, setBlanksDnd] = useState<BlanksDndState>(initialBlanksDndState)
  const [imageDnd, setImageDnd] = useState<ImageDndState>(initialImageDndState)
  const [freeText, setFreeText] = useState<FreeTextState>(initialFreeTextState)
  const [highlight, setHighlight] = useState<Highlight>(null)
  /** field last focused in the editor, the preview scrolls it into view */
  const [focus, setFocus] = useState<Highlight>(null)
  /** bumped to remount the preview, resetting it to its initial state */
  const [previewKey, setPreviewKey] = useState(0)
  const resetPreview = () => setPreviewKey((key) => key + 1)

  function switchType(type: ExerciseType) {
    setExerciseType(type)
    setHighlight(null)
    setFocus(null)
  }

  const editor = {
    "single-choice": (
      <SingleChoiceEditor
        state={singleChoice}
        onChange={setSingleChoice}
        highlight={highlight}
        onFocus={setFocus}
      />
    ),
    "text-input": (
      <TextInputEditor
        state={textInput}
        onChange={setTextInput}
        highlight={highlight}
        onFocus={setFocus}
      />
    ),
    blanks: (
      <BlanksEditor state={blanks} onChange={setBlanks} highlight={highlight} onFocus={setFocus} />
    ),
    "blanks-dnd": (
      <BlanksDndEditor
        state={blanksDnd}
        onChange={setBlanksDnd}
        highlight={highlight}
        onFocus={setFocus}
      />
    ),
    "image-dnd": (
      <ImageDndEditor
        state={imageDnd}
        onChange={setImageDnd}
        highlight={highlight}
        onFocus={setFocus}
      />
    ),
    "free-text": (
      <FreeTextEditor
        state={freeText}
        onChange={setFreeText}
        highlight={highlight}
        onFocus={setFocus}
      />
    ),
  }[exerciseType]

  const preview = {
    "single-choice": (
      <SingleChoicePreview
        state={singleChoice}
        focus={focus}
        onHighlight={setHighlight}
        onReset={resetPreview}
      />
    ),
    "text-input": (
      <TextInputPreview
        state={textInput}
        focus={focus}
        onHighlight={setHighlight}
        onReset={resetPreview}
      />
    ),
    blanks: (
      <BlanksPreview
        state={blanks}
        focus={focus}
        onHighlight={setHighlight}
        onReset={resetPreview}
      />
    ),
    "blanks-dnd": (
      <BlanksDndPreview
        state={blanksDnd}
        focus={focus}
        onHighlight={setHighlight}
        onReset={resetPreview}
      />
    ),
    "image-dnd": (
      <ImageDndPreview
        state={imageDnd}
        focus={focus}
        onHighlight={setHighlight}
        onReset={resetPreview}
      />
    ),
    "free-text": (
      <FreeTextPreview
        state={freeText}
        focus={focus}
        onHighlight={setHighlight}
        onReset={resetPreview}
      />
    ),
  }[exerciseType]

  return (
    <div className="flex h-screen flex-col">
      <ExerciseTypeBar value={exerciseType} onChange={switchType} />
      <SplitPane
        className="min-h-0 flex-1"
        left={
          <div
            className="min-h-full bg-white"
            onPointerDown={() => setHighlight(null)}
            onKeyDown={handleArrowKeyNavigation}
            {...{ [ARROW_NAV_ATTRIBUTE]: "" }}
          >
            {editor}
          </div>
        }
        right={<Fragment key={previewKey}>{preview}</Fragment>}
      />
    </div>
  )
}
