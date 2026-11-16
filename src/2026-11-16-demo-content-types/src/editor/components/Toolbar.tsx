import { Bold, Heading1, Italic, List, ListOrdered, TextCursorInput } from "lucide-react"
import { type CommandAction, type Editor, isMarkActive } from "prosekit/core"
import { useEditor } from "prosekit/react"

const tools = [
  { mark: "bold", label: "Fett", command: "toggleBold", icon: Bold },
  { mark: "italic", label: "Kursiv", command: "toggleItalic", icon: Italic },
  { mark: "gap", label: "Lücke", command: "toggleGap", icon: TextCursorInput },
] as const

export function Toolbar() {
  const editor = useEditor()
  return (
    <div className="toolbar" role="toolbar" aria-label="Formatierung">
      {tools
        .filter(({ mark }) => mark in editor.schema.marks)
        .map(({ mark, label, command, icon: Icon }) => {
          const action = getCommand(editor, command)
          return (
            <button
              key={mark}
              type="button"
              className="toolbar__button"
              aria-label={label}
              aria-pressed={isMarkActive(editor.state, mark)}
              disabled={!editor.mounted || !action?.canExec()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => action?.()}
            >
              <Icon />
            </button>
          )
        })}
      {"heading" in editor.schema.nodes && (
        <button
          type="button"
          className="toolbar__button"
          aria-label="Überschrift"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => getCommand(editor, "toggleHeading")?.({ level: 1 })}
        >
          <Heading1 />
        </button>
      )}
      {"list" in editor.schema.nodes && (
        <>
          <button
            type="button"
            className="toolbar__button"
            aria-label="Aufzählung"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => getCommand(editor, "toggleList")?.({ kind: "bullet" })}
          >
            <List />
          </button>
          <button
            type="button"
            className="toolbar__button"
            aria-label="Nummerierte Liste"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => getCommand(editor, "toggleList")?.({ kind: "ordered" })}
          >
            <ListOrdered />
          </button>
        </>
      )}
    </div>
  )
}

function getCommand(editor: Editor, name: string): CommandAction | undefined {
  const command = editor.commands[name]
  return typeof command === "function" ? command : undefined
}
