import type { Editor } from "@tiptap/react"
import { BadgeHelp, Plus, Trash2 } from "lucide-react"
import { forwardRef, useEffect, useRef, useState } from "react"

import { RichTextEditor } from "@/components/rich-text-editor"
import { cn } from "@/utils/cn"

import { DndBlank, findBlankPos } from "./blank-extension"
import { BLANK_ATTRIBUTE, type BlanksDndState, type Highlight } from "./state"

const highlightRing = "ring-2 ring-indigo-300 ring-offset-2"
const textExtensions = [DndBlank]

export function BlanksDndEditor({
  state,
  onChange,
  highlight,
  onFocus,
}: {
  state: BlanksDndState
  onChange: (state: BlanksDndState) => void
  highlight: Highlight
  /** called when a field gets focus, so the preview can follow along */
  onFocus: (target: Highlight) => void
}) {
  const taskRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const extraRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<Editor | null>(null)

  useEffect(() => {
    if (!highlight) return
    let element: HTMLElement | null = null
    if (highlight.type === "task") element = taskRef.current
    if (highlight.type === "text") element = textRef.current
    if (highlight.type === "extra-answers") element = extraRef.current
    if (highlight.type === "blank" && editor) {
      const pos = findBlankPos(editor.state.doc, highlight.id)
      if (pos !== undefined) {
        const dom = editor.view.nodeDOM(pos)
        element = dom instanceof HTMLElement ? dom.querySelector("input") : null
        element?.focus()
      }
    }
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [highlight, editor])

  /** focus inside the text: either a blank's input or the text itself */
  function onTextFocus(event: React.FocusEvent<HTMLDivElement>) {
    const blank =
      event.target instanceof HTMLElement ? event.target.closest(`input[${BLANK_ATTRIBUTE}]`) : null
    const id = blank?.getAttribute(BLANK_ATTRIBUTE)
    onFocus(id ? { type: "blank", id } : { type: "text" })
  }

  return (
    <div className="mx-auto max-w-3xl px-8 pb-20 pt-16">
      <div className="mb-7 flex items-center justify-start gap-2 text-[#8F9AD6]">
        <span className="text-base">Lückentext (Drag & Drop)</span>
        <BadgeHelp className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <label htmlFor="bd-task" className="mb-3 block text-lg font-bold text-neutral-800">
        Aufgabenstellung
      </label>
      <div onFocusCapture={() => onFocus({ type: "task" })}>
        <RichTextEditor
          id="bd-task"
          ref={taskRef}
          value={state.task}
          onChange={(task) => onChange({ ...state, task })}
          placeholder="z.B. eine Anweisung"
          className={cn("mb-12 scroll-mt-24", highlight?.type === "task" && highlightRing)}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <label htmlFor="bd-text" className="text-lg font-bold text-neutral-800">
          Lückentext
        </label>
        <button
          type="button"
          // keep focus and selection inside the editor
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().insertDndBlank().run()}
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-base font-bold text-neutral-800 transition-colors hover:bg-neutral-50"
        >
          <Plus className="h-5 w-5 text-indigo-500" strokeWidth={1.75} />
          Lücke einfügen
        </button>
      </div>
      <div onFocusCapture={onTextFocus}>
        <RichTextEditor
          id="bd-text"
          ref={textRef}
          value={state.text}
          onChange={(text) => onChange({ ...state, text })}
          placeholder="Markiere ein Wort und füge eine Lücke ein"
          extensions={textExtensions}
          onCreate={setEditor}
          className={cn("scroll-mt-24", highlight?.type === "text" && highlightRing)}
        />
      </div>
      <p className="mt-4 text-sm text-neutral-500">Tippe die Antwort direkt in die Lücke.</p>

      <div onFocusCapture={() => onFocus({ type: "extra-answers" })}>
        <ExtraAnswersPanel
          ref={extraRef}
          answers={state.extraAnswers}
          onChange={(extraAnswers) => onChange({ ...state, extraAnswers })}
          className={cn("scroll-mt-24", highlight?.type === "extra-answers" && highlightRing)}
        />
      </div>
    </div>
  )
}

const ExtraAnswersPanel = forwardRef<
  HTMLDivElement,
  {
    answers: string[]
    onChange: (answers: string[]) => void
    className?: string
  }
>(function ExtraAnswersPanel({ answers, onChange, className }, ref) {
  const [draft, setDraft] = useState("")

  function add() {
    const text = draft.trim()
    if (!text) return
    onChange(answers.includes(text) ? answers : [...answers, text])
    setDraft("")
  }

  return (
    <div ref={ref} className={cn("mt-10 rounded-xl border border-neutral-200 p-6", className)}>
      <h3 className="mb-1 text-lg font-bold text-neutral-800">Falsche Antworten</h3>
      <p className="mb-4 text-sm text-neutral-500">
        Zusätzliche Antworten, die in keine Lücke passen. Sie werden mit den richtigen Antworten
        gemischt angeboten.
      </p>

      {answers.length > 0 ? (
        <ul className="mb-6 flex flex-wrap gap-2">
          {answers.map((answer, index) => (
            <li
              key={answer}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-100 py-1 pl-3 pr-1 text-lg text-neutral-800"
            >
              {answer}
              <button
                type="button"
                aria-label={`${answer} entfernen`}
                onClick={() => onChange(answers.filter((_, other) => other !== index))}
                className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-800"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-6 text-sm text-neutral-500">Noch keine falschen Antworten.</p>
      )}

      <label htmlFor="bd-new-answer" className="mb-2 block text-base font-bold text-neutral-800">
        Antwort hinzufügen
      </label>
      <div className="flex max-w-md items-center gap-2">
        <input
          id="bd-new-answer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            add()
          }}
          placeholder="Eine falsche Antwort"
          className="w-full rounded-lg border border-neutral-200 px-3 py-3 text-lg ring-offset-white placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        />
        <button
          type="button"
          aria-label="Antwort hinzufügen"
          disabled={!draft.trim()}
          onClick={add}
          className="rounded-full bg-[#4C60BA] p-2.5 text-white transition-colors hover:bg-[#3E4F9E] disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
})
