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

import { missingCharacters, type FreeTextState, type Highlight } from "./state"

export function FreeTextPreview({
  state,
  focus,
  onHighlight,
  onReset,
}: {
  state: FreeTextState
  /** field focused in the editor, scrolled into view when it changes */
  focus: Highlight
  onHighlight: (highlight: Highlight) => void
  /** remounts the preview so the answer and scroll position start over */
  onReset: () => void
}) {
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<ValidationStatus>("unchecked")
  const taskRef = useRef<HTMLDivElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focus) return
    // the hint sits right below the textarea, so both share one anchor
    const element = focus.type === "task" ? taskRef.current : answerRef.current
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focus])

  const missing = missingCharacters(value, state.minLength)
  const isTooShort = missing > 0
  const isSubmitted = status === "submitted"

  return (
    <div className="flex h-full flex-col bg-[#FAF6F6]/75 px-16 pb-16 pt-14">
      <PreviewHeader onReset={onReset} />

      <div className="flex min-h-0 flex-1 justify-center">
        <DeviceFrame>
          <DragScrollArea className="h-full">
            {/* generous bottom padding so the validation sheet never covers the textarea */}
            <div className="px-6 pb-48 pt-8">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-0.5 text-sm font-bold text-neutral-500">
                Freitext
                <HelpCircle className="h-4 w-4" />
              </div>

              <RichTextOutput
                ref={taskRef}
                html={state.task}
                placeholder="[Schreibe links eine Aufgabenstellung]"
                onClick={() => onHighlight({ type: "task" })}
                className="mb-8"
              />

              <div ref={answerRef}>
                <textarea
                  aria-label="Deine Antwort"
                  aria-describedby="ft-hint"
                  rows={6}
                  value={value}
                  readOnly={isSubmitted}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="Deine Antwort"
                  className={cn(
                    "w-full resize-none rounded-2xl border px-4 py-3 text-2xl shadow-md placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
                    isSubmitted
                      ? cn(statusBorder.correct, statusBackground.correct)
                      : "border-neutral-300",
                  )}
                />
                {state.minLength > 0 && (
                  <p
                    id="ft-hint"
                    aria-live="polite"
                    onClick={() => onHighlight({ type: "min-length" })}
                    className={cn(
                      "mt-2 px-1 text-base",
                      isTooShort ? "text-neutral-500" : "text-neutral-400",
                    )}
                  >
                    {isTooShort &&
                      `Schreibe noch ${missing} Zeichen, um deine Antwort abschicken zu können.`}
                  </p>
                )}
              </div>
            </div>
          </DragScrollArea>

          <ValidationSheet
            isVisible={value.length > 0}
            status={status}
            checkLabel="Abschicken"
            isCheckDisabled={isTooShort}
            onCheck={() => setStatus("submitted")}
            onRetry={() => setStatus("unchecked")}
          />
        </DeviceFrame>
      </div>
    </div>
  )
}
