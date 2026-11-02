import clsx from "clsx"
import {
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Bold,
  ChevronDown,
  ChevronsDownUp,
  Code,
  Heading1,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  type LucideIcon,
  Shapes,
  Sigma,
  SquareChartGantt,
  Table,
  TextCursorInput,
  Trash2,
  Video,
} from "lucide-react"
import { type CommandAction, type Editor, isMarkActive } from "prosekit/core"
import { useEditor, useEditorDerivedValue } from "prosekit/react"
import { type ReactNode, useState } from "react"

/**
 * Formatting tools, grouped like in the tiptap prototype. Each field only shows the tools
 * its schema supports, so the same toolbar serves single-line and full rich-text fields.
 */
const toolGroups: Tool[][] = [
  [
    markTool("bold", "Fett", Bold, "toggleBold"),
    markTool("italic", "Kursiv", Italic, "toggleItalic"),
    {
      id: "link",
      label: "Link",
      icon: Link,
      isAvailable: (editor) => "link" in editor.schema.marks,
      isActive: (editor) => isMarkActive(editor.state, "link"),
      canExec: () => true,
      run: setLink,
    },
  ],
  [
    nodeTool("heading", "Überschrift 1", Heading1, "toggleHeading", { level: 1 }),
    nodeTool("heading", "Überschrift 2", Heading2, "toggleHeading", { level: 2 }),
  ],
  [
    nodeTool("list", "Nummerierte Liste", ListOrdered, "toggleList", { kind: "ordered" }),
    nodeTool("list", "Aufzählung", List, "toggleList", { kind: "bullet" }),
  ],
  [
    nodeTool("spoiler", "Spoiler", ChevronsDownUp, "toggleSpoiler"),
    nodeTool("box", "Box", SquareChartGantt, "toggleBox"),
  ],
  [
    nodeTool("codeBlock", "Code-Block", Code, "toggleCodeBlock"),
    nodeTool("mathInline", "Formel", Sigma, "insertMath"),
    promptTool("image", "Bild", Image, "insertImage", "Link zum Bild", (src) => [{ src }]),
    promptTool("video", "YouTube-Video", Video, "insertVideo", "Link zum YouTube-Video"),
    promptTool(
      "geogebra",
      "GeoGebra",
      Shapes,
      "insertGeogebra",
      "Link oder ID des GeoGebra-Applets",
    ),
    nodeTool("table", "Tabelle", Table, "insertTable", { row: 3, col: 2, header: true }),
  ],
]

const tableActions = [
  { label: "Zeile darunter einfügen", icon: BetweenHorizontalEnd, command: "addTableRowBelow" },
  { label: "Spalte rechts einfügen", icon: BetweenVerticalEnd, command: "addTableColumnAfter" },
  { label: "Zeile löschen", icon: Trash2, command: "deleteTableRow" },
  { label: "Spalte löschen", icon: Trash2, command: "deleteTableColumn" },
  { label: "Tabelle löschen", icon: Trash2, command: "deleteTable" },
]

export function Toolbar() {
  const editor = useEditor()
  const state = useEditorDerivedValue(deriveToolbarState)
  const groups = toolGroups
    .map((tools) => tools.filter((tool) => state.tools.get(tool)?.isAvailable))
    .filter((tools) => tools.length > 0)

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatierung">
      {groups.map((tools, index) => (
        <div key={tools[0]?.label} className="toolbar__group">
          {index > 0 ? <span className="toolbar__divider" aria-hidden="true" /> : null}
          {tools.map((tool) => {
            const toolState = state.tools.get(tool)
            const Icon = tool.icon
            return (
              <ToolbarButton
                key={tool.label}
                label={tool.label}
                isActive={toolState?.isActive ?? false}
                canExec={toolState?.canExec ?? false}
                onClick={() => tool.run(editor)}
              >
                <Icon />
              </ToolbarButton>
            )
          })}
        </div>
      ))}
      {state.isInTable ? <TableMenu editor={editor} /> : null}
      {state.gap.isAvailable ? (
        <ToolbarButton
          label="Lücke"
          isActive={state.gap.isActive}
          canExec={state.gap.canExec}
          className="toolbar__button--gap"
          onClick={() => execCommand(editor, "toggleGap")}
        >
          <TextCursorInput />
          Lücke
        </ToolbarButton>
      ) : null}
    </div>
  )
}

interface Tool {
  id: string
  label: string
  icon: LucideIcon
  isAvailable: (editor: Editor) => boolean
  isActive: (editor: Editor) => boolean
  canExec: (editor: Editor) => boolean
  run: (editor: Editor) => void
}

function deriveToolbarState(editor: Editor) {
  const mounted = editor.mounted
  const tools = new Map(
    toolGroups.flat().map((tool) => {
      const isAvailable = tool.isAvailable(editor)
      return [
        tool,
        {
          isAvailable,
          isActive: isAvailable && mounted && tool.isActive(editor),
          canExec: isAvailable && mounted && tool.canExec(editor),
        },
      ]
    }),
  )
  const gapAvailable = "gap" in editor.schema.marks
  return {
    tools,
    isInTable: mounted && "table" in editor.schema.nodes && isNodeActive(editor, "table"),
    gap: {
      isAvailable: gapAvailable,
      isActive: gapAvailable && mounted && isMarkActive(editor.state, "gap"),
      canExec: gapAvailable && mounted && canExecCommand(editor, "toggleGap"),
    },
  }
}

function markTool(name: string, label: string, icon: LucideIcon, command: string): Tool {
  return {
    id: name,
    label,
    icon,
    isAvailable: (editor) => name in editor.schema.marks,
    isActive: (editor) => isMarkActive(editor.state, name),
    canExec: (editor) => canExecCommand(editor, command),
    run: (editor) => execCommand(editor, command),
  }
}

function nodeTool(
  name: string,
  label: string,
  icon: LucideIcon,
  command: string,
  attrs?: Record<string, unknown>,
): Tool {
  const args = attrs ? [attrs] : []
  return {
    id: name,
    label,
    icon,
    isAvailable: (editor) => name in editor.schema.nodes,
    isActive: (editor) => command.startsWith("toggle") && isNodeActive(editor, name, attrs),
    canExec: (editor) => canExecCommand(editor, command, ...args),
    run: (editor) => execCommand(editor, command, ...args),
  }
}

/** Inserts a node from a link the author types into a prompt, like the tiptap prototype. */
function promptTool(
  name: string,
  label: string,
  icon: LucideIcon,
  command: string,
  question: string,
  toArgs: (value: string) => unknown[] = (value) => [value],
): Tool {
  return {
    id: name,
    label,
    icon,
    isAvailable: (editor) => name in editor.schema.nodes,
    isActive: () => false,
    canExec: (editor) => canExecCommand(editor, command, ...toArgs("")),
    run: (editor) => {
      const value = window.prompt(question, "https://")?.trim()
      editor.focus()
      if (value && value !== "https://") execCommand(editor, command, ...toArgs(value))
    },
  }
}

function setLink(editor: Editor) {
  const previous = currentLinkHref(editor)
  const url = window.prompt("URL", previous || "https://")
  editor.focus()
  if (url === null) return
  execCommand(editor, "expandLink")
  if (url.trim() === "") execCommand(editor, "removeLink")
  else execCommand(editor, "addLink", { href: url.trim() })
}

function currentLinkHref(editor: Editor) {
  const { $from } = editor.state.selection
  const link = $from.marks().find((mark) => mark.type.name === "link")
  return link ? String(link.attrs.href ?? "") : ""
}

function TableMenu({ editor }: { editor: Editor }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="toolbar__menu">
      <ToolbarButton
        label="Tabelle bearbeiten"
        isActive={isOpen}
        canExec
        className="toolbar__button--menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Table />
        <ChevronDown />
      </ToolbarButton>
      {isOpen ? (
        <ul className="toolbar__menu-list" role="menu">
          {tableActions.map(({ label, icon: Icon, command }) => (
            <li key={command}>
              <button
                type="button"
                role="menuitem"
                className="toolbar__menu-item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  execCommand(editor, command)
                  setIsOpen(false)
                }}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ToolbarButton({
  label,
  canExec,
  isActive,
  className,
  onClick,
  children,
}: {
  label: string
  canExec: boolean
  isActive: boolean
  className?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={clsx("toolbar__button", isActive && "toolbar__button--active", className)}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      disabled={!canExec}
      // keep focus (and selection) inside the editor
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function execCommand(editor: Editor, commandName: string, ...args: unknown[]): void {
  getCommand(editor, commandName)?.(...args)
}

function canExecCommand(editor: Editor, commandName: string, ...args: unknown[]): boolean {
  return getCommand(editor, commandName)?.canExec(...args) ?? false
}

function getCommand(editor: Editor, commandName: string): CommandAction | null {
  const command = editor.commands[commandName]
  return typeof command === "function" ? command : null
}

/** whether the cursor is inside a node of this type, with these attributes if given */
function isNodeActive(editor: Editor, name: string, attrs?: Record<string, unknown>) {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name !== name) continue
    if (!attrs || Object.entries(attrs).every(([key, value]) => node.attrs[key] === value)) {
      return true
    }
  }
  return false
}
