import { HelpCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { DeviceFrame } from "@/components/device-frame"
import { DragScrollArea } from "@/components/drag-scroll-area"
import { PreviewHeader } from "@/components/preview-header"
import { RichTextOutput } from "@/components/rich-text-output"
import { ValidationSheet } from "@/components/validation-sheet"
import { statusBackground, type ValidationStatus } from "@/components/validation-status"
import { cn } from "@/utils/cn"

import type { Highlight, SingleChoiceState } from "./state"

export function SingleChoicePreview({
  state,
  focus,
  onHighlight,
  onReset,
}: {
  state: SingleChoiceState
  /** field focused in the editor, scrolled into view when it changes */
  focus: Highlight
  onHighlight: (highlight: Highlight) => void
  /** remounts the preview so answers, status and scroll position start over */
  onReset: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<ValidationStatus>("unchecked")
  const taskRef = useRef<HTMLDivElement>(null)
  const answerRefs = useRef(new Map<string, HTMLLIElement>())

  useEffect(() => {
    if (!focus) return
    const element = focus.type === "answer" ? answerRefs.current.get(focus.id) : taskRef.current
    // "nearest" leaves the scroll position alone when the element is already visible
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focus])

  function check() {
    const selected = state.answers.find((answer) => answer.id === selectedId)
    setStatus(selected?.isCorrect ? "correct" : "incorrect")
  }

  /** clears the user input only, the exercise itself stays untouched */
  function reset() {
    setSelectedId(null)
    setStatus("retry")
  }

  /** set once the answer has been checked, cn() has no tailwind-merge */
  const checkedBackground =
    status === "correct" || status === "incorrect" ? statusBackground[status] : null

  return (
    <div className="flex h-full flex-col bg-[#FAF6F6]/75 px-16 pb-16 pt-14">
      <PreviewHeader onReset={onReset} />

      <div className="flex min-h-0 flex-1 justify-center">
        <DeviceFrame>
          <DragScrollArea className="h-full">
            {/* generous bottom padding so the validation sheet never covers the last answer */}
            <div className="px-6 pb-48 pt-8">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-0.5 text-sm font-bold text-neutral-500">
                Single Choice
                <HelpCircle className="h-4 w-4" />
              </div>

              <RichTextOutput
                ref={taskRef}
                html={state.task}
                placeholder="[Schreibe links eine Aufgabenstellung]"
                onClick={() => onHighlight({ type: "task" })}
                className="mb-8"
              />

              <ul className="space-y-3">
                {state.answers.map((answer) => (
                  <li
                    key={answer.id}
                    ref={(element) => {
                      if (element) answerRefs.current.set(answer.id, element)
                      else answerRefs.current.delete(answer.id)
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(answer.id)
                        setStatus("unchecked")
                        onHighlight({ type: "answer", id: answer.id })
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-2 text-left text-2xl shadow-md transition-colors",
                        selectedId === answer.id
                          ? // the checked answer picks up the sheet's colour
                            cn("border-neutral-500", checkedBackground ?? "bg-neutral-50")
                          : "border-neutral-300 hover:bg-neutral-50",
                        !answer.text && "opacity-50",
                      )}
                    >
                      <span className="min-w-0 hyphens-auto break-words" lang="de">
                        {answer.text.length ? answer.text : <>&nbsp;</>}
                      </span>
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-800",
                          selectedId === answer.id && "border-neutral-900",
                        )}
                      >
                        {selectedId === answer.id && (
                          <span className="h-3 w-3 rounded-full bg-neutral-900" />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </DragScrollArea>

          <ValidationSheet
            isVisible={selectedId !== null || status === "retry"}
            status={status}
            onCheck={check}
            onRetry={reset}
          />
        </DeviceFrame>
      </div>
    </div>
  )
}
