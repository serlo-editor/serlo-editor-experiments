import { HelpCircle } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { DeviceFrame } from "@/components/device-frame"
import { DragScrollArea } from "@/components/drag-scroll-area"
import { PreviewHeader } from "@/components/preview-header"
import { RichTextOutput } from "@/components/rich-text-output"
import { ValidationSheet } from "@/components/validation-sheet"
import type { ValidationStatus } from "@/components/validation-status"
import { cn } from "@/utils/cn"

import {
  BLANK_ATTRIBUTE,
  isBlankCorrect,
  readAnswers,
  type BlanksState,
  type Highlight,
} from "./state"

/** a blank placeholder element inside the rendered text */
interface Slot {
  id: string
  answers: string[]
  element: HTMLElement
}

export function BlanksPreview({
  state,
  focus,
  onHighlight,
  onReset,
}: {
  state: BlanksState
  /** field focused in the editor, scrolled into view when it changes */
  focus: Highlight
  onHighlight: (highlight: Highlight) => void
  /** remounts the preview so answers, status and scroll position start over */
  onReset: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<ValidationStatus>("unchecked")
  const [slots, setSlots] = useState<Slot[]>([])
  const taskRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const inputRefs = useRef(new Map<string, HTMLInputElement>())

  // the text is rendered as HTML, the inputs are portalled into its blanks
  useLayoutEffect(() => {
    const container = textRef.current
    if (!container) return
    const elements = Array.from(container.querySelectorAll<HTMLElement>(`span[${BLANK_ATTRIBUTE}]`))
    setSlots(
      elements.map((element) => ({
        id: element.getAttribute(BLANK_ATTRIBUTE) ?? "",
        answers: readAnswers(element),
        element,
      })),
    )
  }, [state.text])

  useEffect(() => {
    if (!focus) return
    let element: HTMLElement | null | undefined = null
    if (focus.type === "task") element = taskRef.current
    if (focus.type === "text") element = textRef.current
    if (focus.type === "blank") element = inputRefs.current.get(focus.id)
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focus])

  const isChecked = status === "correct" || status === "incorrect"
  const hasInput = Object.values(values).some((value) => value.trim())

  function check() {
    const allCorrect = slots.every((slot) => isBlankCorrect(slot.answers, values[slot.id] ?? ""))
    setStatus(allCorrect ? "correct" : "incorrect")
  }

  /** clears the learner input only, the exercise itself stays untouched */
  function reset() {
    setValues({})
    setStatus("retry")
  }

  return (
    <div className="flex h-full flex-col bg-[#FAF6F6]/75 px-16 pb-16 pt-14">
      <PreviewHeader onReset={onReset} />

      <div className="flex min-h-0 flex-1 justify-center">
        <DeviceFrame>
          <DragScrollArea className="h-full">
            {/* generous bottom padding so the validation sheet never covers the blanks */}
            <div className="px-6 pb-48 pt-8">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-0.5 text-sm font-bold text-neutral-500">
                Lückentext
                <HelpCircle className="h-4 w-4" />
              </div>

              <RichTextOutput
                ref={taskRef}
                html={state.task}
                placeholder="[Schreibe links eine Aufgabenstellung]"
                onClick={() => onHighlight({ type: "task" })}
                className="mb-8"
              />

              <RichTextOutput
                ref={textRef}
                html={state.text}
                placeholder="[Schreibe links einen Lückentext]"
                onClick={() => onHighlight({ type: "text" })}
                className="leading-loose"
              />

              {slots.map((slot) => {
                const value = values[slot.id] ?? ""
                const isCorrect = isBlankCorrect(slot.answers, value)
                const longest = Math.max(4, ...slot.answers.map((answer) => answer.length))
                return createPortal(
                  <input
                    key={slot.id}
                    ref={(element) => {
                      if (element) inputRefs.current.set(slot.id, element)
                      else inputRefs.current.delete(slot.id)
                    }}
                    aria-label="Lücke"
                    value={value}
                    readOnly={isChecked}
                    style={{ width: `${longest + 2}ch` }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onHighlight({ type: "blank", id: slot.id })
                    }}
                    onChange={(event) => {
                      setValues({ ...values, [slot.id]: event.target.value })
                      setStatus("unchecked")
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && hasInput && !isChecked) check()
                    }}
                    className={cn(
                      "mx-1 inline-block max-w-full rounded-xl border border-neutral-300 px-3 py-1 align-baseline font-sans text-2xl shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
                      // each checked blank shows its own result
                      isChecked ? (isCorrect ? "bg-[#F1FCE9]" : "bg-[#FBF0E8]") : "bg-white",
                    )}
                  />,
                  slot.element,
                  slot.id,
                )
              })}
            </div>
          </DragScrollArea>

          <ValidationSheet
            isVisible={hasInput || status === "retry"}
            status={status}
            onCheck={check}
            onRetry={reset}
          />
        </DeviceFrame>
      </div>
    </div>
  )
}
