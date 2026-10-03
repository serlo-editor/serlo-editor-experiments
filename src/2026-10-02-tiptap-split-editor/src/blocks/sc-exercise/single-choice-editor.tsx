import { BadgeHelp, CheckCircle2, Circle, Plus, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { RichTextEditor } from "@/components/rich-text-editor"
import { cn } from "@/utils/cn"

import { createAnswer, type Highlight, type SingleChoiceState } from "./state"

const highlightRing = "ring-2 ring-indigo-300 ring-offset-2"

export function SingleChoiceEditor({
  state,
  onChange,
  highlight,
  onFocus,
}: {
  state: SingleChoiceState
  onChange: (state: SingleChoiceState) => void
  highlight: Highlight
  /** called when a field gets focus, so the preview can follow along */
  onFocus: (target: Highlight) => void
}) {
  const inputRefs = useRef(new Map<string, HTMLInputElement>())
  const cardRefs = useRef(new Map<string, HTMLLIElement>())
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
      highlight.type === "answer" ? cardRefs.current.get(highlight.id) : taskRef.current
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [highlight])

  function addAnswer() {
    const answer = createAnswer()
    onChange({ ...state, answers: [...state.answers, answer] })
    setFocusId(answer.id)
  }

  function setAnswerText(id: string, text: string) {
    onChange({
      ...state,
      answers: state.answers.map((answer) => (answer.id === id ? { ...answer, text } : answer)),
    })
  }

  // single choice: marking one answer correct unmarks all others
  function markCorrect(id: string) {
    onChange({
      ...state,
      answers: state.answers.map((answer) => ({
        ...answer,
        isCorrect: answer.id === id,
      })),
    })
  }

  function removeAnswer(id: string) {
    inputRefs.current.delete(id)
    cardRefs.current.delete(id)
    onChange({
      ...state,
      answers: state.answers.filter((answer) => answer.id !== id),
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-8 pb-20 pt-16">
      <div className="mb-7 flex items-center justify-start gap-2 text-[#8F9AD6]">
        <span className="text-base">Single Choice</span>
        <BadgeHelp className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <label htmlFor="sc-task" className="mb-3 block text-lg font-bold text-neutral-800">
        Aufgabenstellung
      </label>
      <div onFocusCapture={() => onFocus({ type: "task" })}>
        <RichTextEditor
          id="sc-task"
          ref={taskRef}
          value={state.task}
          onChange={(task) => onChange({ ...state, task })}
          placeholder="z.B. eine Frage"
          className={cn("mb-12 scroll-mt-24", highlight?.type === "task" && highlightRing)}
        />
      </div>

      <h3 className="mb-4 text-lg font-bold text-neutral-800">Antworten</h3>

      <ul className="space-y-3">
        {state.answers.map((answer) => (
          <li
            key={answer.id}
            ref={(element) => {
              if (element) cardRefs.current.set(answer.id, element)
              else cardRefs.current.delete(answer.id)
            }}
            onFocusCapture={() => onFocus({ type: "answer", id: answer.id })}
            className={cn(
              "flex scroll-mt-24 items-center gap-4 rounded-lg ring-offset-white",
              highlight?.type === "answer" && highlight.id === answer.id && highlightRing,
            )}
          >
            <div className="relative flex-1 max-w-md">
              <input
                ref={(element) => {
                  if (element) inputRefs.current.set(answer.id, element)
                  else inputRefs.current.delete(answer.id)
                }}
                aria-label="Antwort"
                value={answer.text}
                onChange={(event) => setAnswerText(answer.id, event.target.value)}
                placeholder="Eine mögliche Antwort"
                className="w-full rounded-lg border border-neutral-200 py-3 pl-3 pr-12 text-lg placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
              />
              <button
                type="button"
                aria-label="Antwort löschen"
                onClick={() => removeAnswer(answer.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-neutral-500 transition-colors hover:bg-indigo-50 hover:text-neutral-800"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>

            <div className="flex w-24 shrink-0 items-center">
              {answer.isCorrect ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-green-100 px-2 py-1 text-sm font-bold text-green-900">
                  <CheckCircle2 className="h-4 w-4 fill-green-900 text-green-100" />
                  Richtig
                </span>
              ) : (
                <button
                  type="button"
                  title="Zur richtigen Antwort machen"
                  onClick={() => markCorrect(answer.id)}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-neutral-100 px-2 py-1 text-sm font-bold text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
                >
                  <Circle className="h-4 w-4" strokeWidth={2} />
                  Falsch
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addAnswer}
        className="mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-base font-bold text-neutral-800 transition-colors hover:bg-neutral-50"
      >
        <Plus className="h-5 w-5 text-indigo-500" strokeWidth={1.75} />
        Neue Antwort hinzufügen
      </button>
    </div>
  )
}
