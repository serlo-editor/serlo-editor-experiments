import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { cn } from "@/utils/cn"

/** a list of short text answers with a field to add one more */
export function AnswerList({
  id,
  answers,
  onChange,
  placeholder,
  emptyLabel,
  size = "md",
}: {
  id: string
  answers: string[]
  onChange: (answers: string[]) => void
  placeholder: string
  emptyLabel: string
  size?: "sm" | "md"
}) {
  const [draft, setDraft] = useState("")

  function add() {
    const text = draft.trim()
    if (!text) return
    onChange(answers.includes(text) ? answers : [...answers, text])
    setDraft("")
  }

  const textSize = size === "sm" ? "text-base" : "text-lg"

  return (
    <div>
      {answers.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {answers.map((answer, index) => (
            <li
              key={answer}
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-neutral-100 py-1 pl-3 pr-1 text-neutral-800",
                textSize,
              )}
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
        <p className="mb-3 text-sm text-neutral-500">{emptyLabel}</p>
      )}

      <div className={cn("flex items-center gap-2", size === "sm" ? "max-w-xs" : "max-w-md")}>
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            add()
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-neutral-200 px-3 ring-offset-white placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
            size === "sm" ? "py-2 text-base" : "py-3 text-lg",
          )}
        />
        <button
          type="button"
          aria-label="Antwort hinzufügen"
          disabled={!draft.trim()}
          onClick={add}
          className={cn(
            "rounded-full bg-[#4C60BA] text-white transition-colors hover:bg-[#3E4F9E] disabled:cursor-not-allowed disabled:bg-neutral-300",
            size === "sm" ? "p-2" : "p-2.5",
          )}
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
