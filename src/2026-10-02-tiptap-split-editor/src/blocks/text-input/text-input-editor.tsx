import { BadgeHelp, Plus, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { RichTextEditor } from "@/components/rich-text-editor"
import { cn } from "@/utils/cn"

import { createTextAnswer, type Highlight, type TextAnswer, type TextInputState } from "./state"

const highlightRing = "ring-2 ring-indigo-300 ring-offset-2"

export function TextInputEditor({
  state,
  onChange,
  highlight,
  onFocus,
}: {
  state: TextInputState
  onChange: (state: TextInputState) => void
  highlight: Highlight
  /** called when a field gets focus, so the preview can follow along */
  onFocus: (target: Highlight) => void
}) {
  const inputRefs = useRef(new Map<string, HTMLInputElement>())
  const taskRef = useRef<HTMLDivElement>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    if (!focusId) return
    inputRefs.current.get(focusId)?.focus()
    setFocusId(null)
  }, [focusId])

  useEffect(() => {
    if (!highlight) return
    const element =
      highlight.type === "answer" ? inputRefs.current.get(highlight.id) : taskRef.current
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [highlight])

  /** appends by default, or inserts after the given answer */
  function addAnswer(afterId?: string) {
    const answer = createTextAnswer()
    const index = state.answers.findIndex(({ id }) => id === afterId)
    const answers = [...state.answers]
    answers.splice(index === -1 ? answers.length : index + 1, 0, answer)
    onChange({ ...state, answers })
    setFocusId(answer.id)
  }

  function setAnswerText(id: string, text: string) {
    onChange({
      ...state,
      answers: state.answers.map((answer) => (answer.id === id ? { ...answer, text } : answer)),
    })
  }

  function removeAnswer(id: string) {
    inputRefs.current.delete(id)
    onChange({
      ...state,
      answers: state.answers.filter((answer) => answer.id !== id),
    })
  }

  function focusNeighbour(id: string, offset: -1 | 1) {
    const index = state.answers.findIndex((answer) => answer.id === id)
    const neighbour = state.answers[index + offset]
    if (!neighbour) return false
    inputRefs.current.get(neighbour.id)?.focus()
    return true
  }

  function onAnswerKeyDown(answer: TextAnswer, event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "Enter":
        if (!answer.text.trim()) break
        event.preventDefault()
        addAnswer(answer.id)
        break
      case "Backspace":
        if (answer.text) break
        event.preventDefault()
        // keep the caret in the list: previous input, else the next one
        if (!focusNeighbour(answer.id, -1)) focusNeighbour(answer.id, 1)
        removeAnswer(answer.id)
        break
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 pb-20 pt-16">
      <div className="mb-7 flex items-center justify-start gap-2 text-[#8F9AD6]">
        <span className="text-base">Texteingabe</span>
        <BadgeHelp className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <label htmlFor="ti-task" className="mb-3 block text-lg font-bold text-neutral-800">
        Aufgabenstellung
      </label>
      <div onFocusCapture={() => onFocus({ type: "task" })}>
        <RichTextEditor
          id="ti-task"
          ref={taskRef}
          value={state.task}
          onChange={(task) => onChange({ ...state, task })}
          placeholder="z.B. eine Frage"
          className={cn("mb-12 scroll-mt-24", highlight?.type === "task" && highlightRing)}
        />
      </div>

      <h3 className="mb-4 text-lg font-bold text-neutral-800">Richtige Antworten</h3>
      <ul className="space-y-3">
        {state.answers.map((answer) => (
          <AnswerRow
            key={answer.id}
            answer={answer}
            isHighlighted={highlight?.type === "answer" && highlight.id === answer.id}
            inputRef={(element) => {
              if (element) inputRefs.current.set(answer.id, element)
              else inputRefs.current.delete(answer.id)
            }}
            onFocus={() => onFocus({ type: "answer", id: answer.id })}
            onChange={(text) => setAnswerText(answer.id, text)}
            onKeyDown={(event) => onAnswerKeyDown(answer, event)}
            onRemove={() => removeAnswer(answer.id)}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => addAnswer()}
        className="mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-base font-bold text-neutral-800 transition-colors hover:bg-neutral-50"
      >
        <Plus className="h-5 w-5 text-indigo-500" strokeWidth={1.75} />
        Richtige Antwort hinzufügen
      </button>
    </div>
  )
}

function AnswerRow({
  answer,
  isHighlighted,
  inputRef,
  onFocus,
  onChange,
  onKeyDown,
  onRemove,
}: {
  answer: TextAnswer
  isHighlighted: boolean
  inputRef: (element: HTMLInputElement | null) => void
  onFocus: () => void
  onChange: (text: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onRemove: () => void
}) {
  return (
    <li className="relative max-w-md">
      <input
        ref={inputRef}
        aria-label="Richtige Antwort"
        value={answer.text}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Eine mögliche Eingabe"
        className={cn(
          "w-full scroll-mt-24 rounded-lg border border-neutral-200 py-3 pl-3 pr-12 text-lg ring-offset-white placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
          isHighlighted && highlightRing,
        )}
      />
      <button
        type="button"
        aria-label="Antwort löschen"
        onClick={onRemove}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-neutral-500 transition-colors hover:bg-indigo-50 hover:text-neutral-800"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </li>
  )
}
