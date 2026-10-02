import { NodeSelection } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"
import { BadgeHelp, Plus, Trash2 } from "lucide-react"
import { forwardRef, useEffect, useRef, useState } from "react"

import { RichTextEditor } from "@/components/rich-text-editor"
import { cn } from "@/utils/cn"

import { Blank, findBlankPos, selectedBlank, type BlankAttributes } from "./blank-extension"
import type { BlanksState, Highlight } from "./state"

const highlightRing = "ring-2 ring-indigo-300 ring-offset-2"
const textExtensions = [Blank]

export function BlanksEditor({
  state,
  onChange,
  highlight,
  onFocus,
}: {
  state: BlanksState
  onChange: (state: BlanksState) => void
  highlight: Highlight
  /** called when a field gets focus, so the preview can follow along */
  onFocus: (target: Highlight) => void
}) {
  const taskRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  /** the blank selected in the text editor, its answers are edited below */
  const [active, setActive] = useState<BlankAttributes | null>(null)

  useEffect(() => {
    if (!editor) return
    const sync = () => setActive(selectedBlank(editor.state.selection))
    // focus left the editor for somewhere other than the answer panel: the
    // blank is no longer active
    const onBlur = ({ event }: { event: FocusEvent }) =>
      leaveBlank(editor, panelRef.current, event.relatedTarget)
    editor.on("transaction", sync)
    editor.on("blur", onBlur)
    sync()
    return () => {
      editor.off("transaction", sync)
      editor.off("blur", onBlur)
    }
  }, [editor])

  const activeId = active?.id
  useEffect(() => {
    if (activeId) onFocus({ type: "blank", id: activeId })
  }, [activeId, onFocus])

  useEffect(() => {
    if (!highlight) return
    let element: HTMLElement | null = null
    if (highlight.type === "task") element = taskRef.current
    if (highlight.type === "text") element = textRef.current
    if (highlight.type === "blank" && editor) {
      const pos = findBlankPos(editor.state.doc, highlight.id)
      if (pos !== undefined) {
        // selecting the blank opens its answer panel
        editor.commands.setNodeSelection(pos)
        element = editor.view.nodeDOM(pos) as HTMLElement | null
      }
    }
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [highlight, editor])

  function setAnswers(answers: string[]) {
    if (!editor || !active) return
    editor.commands.updateBlankAnswers(active.id, answers)
  }

  return (
    <div className="mx-auto max-w-3xl px-8 pb-20 pt-16">
      <div className="mb-7 flex items-center justify-start gap-2 text-[#8F9AD6]">
        <span className="text-base">Lückentext</span>
        <BadgeHelp className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <label htmlFor="bl-task" className="mb-3 block text-lg font-bold text-neutral-800">
        Aufgabenstellung
      </label>
      <div onFocusCapture={() => onFocus({ type: "task" })}>
        <RichTextEditor
          id="bl-task"
          ref={taskRef}
          value={state.task}
          onChange={(task) => onChange({ ...state, task })}
          placeholder="z.B. eine Anweisung"
          className={cn("mb-12 scroll-mt-24", highlight?.type === "task" && highlightRing)}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <label htmlFor="bl-text" className="text-lg font-bold text-neutral-800">
          Lückentext
        </label>
        <button
          type="button"
          // keep focus and selection inside the editor
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().insertBlank().run()}
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-base font-bold text-neutral-800 transition-colors hover:bg-neutral-50"
        >
          <Plus className="h-5 w-5 text-indigo-500" strokeWidth={1.75} />
          Lücke einfügen
        </button>
      </div>
      <div onFocusCapture={() => onFocus({ type: "text" })}>
        <RichTextEditor
          id="bl-text"
          ref={textRef}
          value={state.text}
          onChange={(text) => onChange({ ...state, text })}
          placeholder="Markiere ein Wort und füge eine Lücke ein"
          extensions={textExtensions}
          onCreate={setEditor}
          className={cn("scroll-mt-24", highlight?.type === "text" && highlightRing)}
        />
      </div>

      {active ? (
        <AnswerPanel
          key={active.id}
          ref={panelRef}
          answers={active.answers}
          onChange={setAnswers}
          onBlur={(event) => editor && leaveBlank(editor, panelRef.current, event.relatedTarget)}
        />
      ) : (
        <p className="mt-4 text-sm text-neutral-500">
          Wähle eine Lücke im Text aus, um ihre gültigen Antworten zu bearbeiten.
        </p>
      )}
    </div>
  )
}

/**
 * Deselects the blank when focus moves somewhere that is neither the text
 * editor nor the answer panel. The panel closes with the selection.
 */
function leaveBlank(editor: Editor, panel: HTMLElement | null, next: EventTarget | null) {
  if (next instanceof Node && (panel?.contains(next) || editor.view.dom.contains(next))) return
  const { selection } = editor.state
  if (selection instanceof NodeSelection) editor.commands.setTextSelection(selection.to)
}

const AnswerPanel = forwardRef<
  HTMLDivElement,
  {
    answers: string[]
    onChange: (answers: string[]) => void
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => void
  }
>(function AnswerPanel({ answers, onChange, onBlur }, ref) {
  const [draft, setDraft] = useState("")

  function add() {
    const text = draft.trim()
    if (!text) return
    onChange(answers.includes(text) ? answers : [...answers, text])
    setDraft("")
  }

  return (
    <div ref={ref} onBlur={onBlur} className="mt-6 rounded-xl border border-neutral-200 p-6">
      <h3 className="mb-4 text-lg font-bold text-neutral-800">Gültige Antworten</h3>

      {answers.length > 0 ? (
        <ul className="mb-6 flex flex-wrap gap-2">
          {answers.map((answer, index) => (
            <li
              key={answer}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 py-1 pl-3 pr-1 text-lg text-indigo-900"
            >
              {answer}
              <button
                type="button"
                aria-label={`${answer} entfernen`}
                // keep the editor's selection, the panel must not close
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChange(answers.filter((_, other) => other !== index))}
                className="rounded-full p-1.5 text-indigo-900/70 transition-colors hover:bg-indigo-100 hover:text-indigo-950"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-6 text-sm text-neutral-500">
          Noch keine Antwort. Die Lücke gilt erst mit mindestens einer gültigen Antwort.
        </p>
      )}

      <label htmlFor="bl-new-answer" className="mb-2 block text-base font-bold text-neutral-800">
        Antwort hinzufügen
      </label>
      <div className="flex max-w-md items-center gap-2">
        <input
          id="bl-new-answer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            add()
          }}
          placeholder="Eine gültige Eingabe"
          className="w-full rounded-lg border border-neutral-200 px-3 py-3 text-lg ring-offset-white placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        />
        <button
          type="button"
          aria-label="Antwort hinzufügen"
          disabled={!draft.trim()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={add}
          className="rounded-full bg-[#4C60BA] p-2.5 text-white transition-colors hover:bg-[#3E4F9E] disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
})
