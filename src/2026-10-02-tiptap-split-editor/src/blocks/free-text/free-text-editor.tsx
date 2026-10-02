import { BadgeHelp } from "lucide-react"
import { useEffect, useRef } from "react"

import { RichTextEditor } from "@/components/rich-text-editor"
import { cn } from "@/utils/cn"

import type { FreeTextState, Highlight } from "./state"

const highlightRing = "ring-2 ring-indigo-300 ring-offset-2"

export function FreeTextEditor({
  state,
  onChange,
  highlight,
  onFocus,
}: {
  state: FreeTextState
  onChange: (state: FreeTextState) => void
  highlight: Highlight
  /** called when a field gets focus, so the preview can follow along */
  onFocus: (target: Highlight) => void
}) {
  const taskRef = useRef<HTMLDivElement>(null)
  const minLengthRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!highlight) return
    const element = highlight.type === "task" ? taskRef.current : minLengthRef.current
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [highlight])

  function setMinLength(value: string) {
    // an empty field means no minimum
    const minLength = Number.parseInt(value, 10)
    onChange({
      ...state,
      minLength: Number.isNaN(minLength) ? 0 : Math.max(0, minLength),
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-8 pb-20 pt-16">
      <div className="mb-7 flex items-center justify-start gap-2 text-[#8F9AD6]">
        <span className="text-base">Freitext</span>
        <BadgeHelp className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <label htmlFor="ft-task" className="mb-3 block text-lg font-bold text-neutral-800">
        Aufgabenstellung
      </label>
      <div onFocusCapture={() => onFocus({ type: "task" })}>
        <RichTextEditor
          id="ft-task"
          ref={taskRef}
          value={state.task}
          onChange={(task) => onChange({ ...state, task })}
          placeholder="z.B. eine Frage"
          className={cn("mb-12 scroll-mt-24", highlight?.type === "task" && highlightRing)}
        />
      </div>

      <label htmlFor="ft-min-length" className="mb-3 block text-lg font-bold text-neutral-800">
        Mindestlänge der Antwort
      </label>
      <div className="flex items-center gap-3">
        <input
          id="ft-min-length"
          ref={minLengthRef}
          type="number"
          min={0}
          step={10}
          value={state.minLength}
          onFocus={() => onFocus({ type: "min-length" })}
          onChange={(event) => setMinLength(event.target.value)}
          className={cn(
            "w-28 scroll-mt-24 rounded-lg border border-neutral-200 px-3 py-3 text-lg ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
            highlight?.type === "min-length" && highlightRing,
          )}
        />
        <span className="text-base text-neutral-600">Zeichen</span>
      </div>
      <p className="mt-3 max-w-md text-sm text-neutral-500">
        Erst ab dieser Länge können Lernende ihre Antwort abschicken. 0 bedeutet keine Mindestlänge.
      </p>
    </div>
  )
}
