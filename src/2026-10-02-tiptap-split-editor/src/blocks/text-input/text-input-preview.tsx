import { HelpCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { DeviceFrame } from "@/components/device-frame"
import { DragScrollArea } from "@/components/drag-scroll-area"
import { PreviewHeader } from "@/components/preview-header"
import { RichTextOutput } from "@/components/rich-text-output"
import { ValidationSheet } from "@/components/validation-sheet"
import {
  statusBackground,
  statusBorder,
  type ValidationStatus,
} from "@/components/validation-status"
import { cn } from "@/utils/cn"

import { normalizeAnswer, type Highlight, type TextInputState } from "./state"

export function TextInputPreview({
  state,
  focus,
  onHighlight,
  onReset,
}: {
  state: TextInputState
  /** field focused in the editor, scrolled into view when it changes */
  focus: Highlight
  onHighlight: (highlight: Highlight) => void
  /** remounts the preview so answers, status and scroll position start over */
  onReset: () => void
}) {
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<ValidationStatus>("unchecked")
  const taskRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!focus) return
    // every answer lives in the same input field
    const element = focus.type === "task" ? taskRef.current : inputRef.current
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focus])

  function check() {
    const input = normalizeAnswer(value)
    const match = state.answers.find(
      (answer) => answer.text && normalizeAnswer(answer.text) === input,
    )
    setStatus(match ? "correct" : "incorrect")
    if (match) onHighlight({ type: "answer", id: match.id })
  }

  /** clears the user input only, the exercise itself stays untouched */
  function reset() {
    setValue("")
    setStatus("retry")
  }

  const isChecked = status === "correct" || status === "incorrect"

  return (
    <div className="flex h-full flex-col bg-[#FAF6F6]/75 px-16 pb-16 pt-14">
      <PreviewHeader onReset={onReset} />

      <div className="flex min-h-0 flex-1 justify-center">
        <DeviceFrame>
          <DragScrollArea className="h-full">
            {/* generous bottom padding so the validation sheet never covers the input */}
            <div className="px-6 pb-48 pt-8">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-0.5 text-sm font-bold text-neutral-500">
                Texteingabe
                <HelpCircle className="h-4 w-4" />
              </div>

              <RichTextOutput
                ref={taskRef}
                html={state.task}
                placeholder="[Schreibe links eine Aufgabenstellung]"
                onClick={() => onHighlight({ type: "task" })}
                className="mb-8"
              />

              <input
                ref={inputRef}
                aria-label="Deine Antwort"
                value={value}
                readOnly={isChecked}
                onChange={(event) => {
                  setValue(event.target.value)
                  setStatus("unchecked")
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && value.trim() && !isChecked) check()
                }}
                placeholder="Tippe deine Antwort"
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-2xl shadow-md placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
                  // the checked input picks up the sheet's colour
                  isChecked
                    ? cn(statusBorder[status], statusBackground[status])
                    : "border-neutral-300",
                )}
              />
            </div>
          </DragScrollArea>

          <ValidationSheet
            isVisible={value.trim().length > 0 || status === "retry"}
            status={status}
            onCheck={check}
            onRetry={reset}
          />
        </DeviceFrame>
      </div>
    </div>
  )
}
