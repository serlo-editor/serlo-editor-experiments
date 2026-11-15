import clsx from "clsx"
import { type CommandAction, type Editor, isMarkActive } from "prosekit/core"

import styles from "./Toolbar.module.css"

export function Toolbar({ editor }: { editor: Editor | null }) {
  const canToggleGap = canExecCommand(editor, "toggleGap")

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting controls">
      {editor?.schema.nodes.paragraph && (
        <ToolbarButton
          label="Paragraph"
          shortLabel="¶"
          isActive={
            isNodeActiveInEditor(editor, "paragraph") && !isNodeActiveInEditor(editor, "list")
          }
          canExec={canExecCommand(editor, "unwrapList") || canExecCommand(editor, "setParagraph")}
          onClick={() => {
            execCommand(editor, "unwrapList")
            execCommand(editor, "setParagraph")
          }}
        />
      )}
      {editor?.schema.nodes.heading &&
        [1, 2, 3, 4, 5, 6].map((level) => (
          <ToolbarButton
            key={level}
            label={`Heading ${level}`}
            shortLabel={`H${level}`}
            isActive={isNodeActiveInEditor(editor, "heading", { level })}
            canExec={canExecCommand(editor, "toggleHeading", { level })}
            onClick={() => execCommand(editor, "toggleHeading", { level })}
          />
        ))}
      {editor?.schema.nodes.list &&
        [
          { kind: "bullet", label: "Bullet list", shortLabel: "• List" },
          { kind: "ordered", label: "Numbered list", shortLabel: "1. List" },
        ].map(({ kind, label, shortLabel }) => (
          <ToolbarButton
            key={kind}
            label={label}
            shortLabel={shortLabel}
            isActive={isNodeActiveInEditor(editor, "list", { kind })}
            canExec={canExecCommand(editor, "toggleList", { kind })}
            onClick={() => execCommand(editor, "toggleList", { kind })}
          />
        ))}
      <ToolbarButton
        label="Bold"
        shortLabel="B"
        isActive={isMarkActiveInEditor(editor, "bold")}
        canExec={canExecCommand(editor, "toggleBold")}
        onClick={() => execCommand(editor, "toggleBold")}
      />
      <ToolbarButton
        label="Italic"
        shortLabel="I"
        isActive={isMarkActiveInEditor(editor, "italic")}
        canExec={canExecCommand(editor, "toggleItalic")}
        onClick={() => execCommand(editor, "toggleItalic")}
      />
      {canToggleGap ? (
        <ToolbarButton
          label="Gap"
          shortLabel="Gap"
          isActive={isMarkActiveInEditor(editor, "gap")}
          canExec={canToggleGap}
          onClick={() => execCommand(editor, "toggleGap")}
        />
      ) : null}
    </div>
  )
}

function ToolbarButton({
  label,
  shortLabel,
  canExec,
  isActive,
  onClick,
}: {
  label: string
  shortLabel: string
  canExec: boolean
  isActive: boolean
  onClick: () => void
}) {
  const className = clsx(
    styles.button,
    canExec ? styles.enabled : styles.disabled,
    isActive && styles.active,
  )

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={isActive}
      disabled={!canExec}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {shortLabel}
    </button>
  )
}

function isNodeActiveInEditor(
  editor: Editor,
  nodeName: string,
  attrs?: { level?: number; kind?: string },
): boolean {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth)
    if (
      node.type.name === nodeName &&
      Object.entries(attrs ?? {}).every(([key, value]) => node.attrs[key] === value)
    ) {
      return true
    }
  }
  return false
}

function isMarkActiveInEditor(editor: Editor | null, markName: string): boolean {
  if (editor == null) return false
  if (!(markName in editor.schema.marks)) return false

  return isMarkActive(editor.state, markName)
}

function execCommand(editor: Editor | null, commandName: string, attrs?: object): void {
  if (editor == null) return

  const command = getCommand(editor, commandName)

  if (command != null) {
    if (attrs) command(attrs)
    else command()
  }
}

function canExecCommand(editor: Editor | null, commandName: string, attrs?: object): boolean {
  if (editor == null) return false

  const command = getCommand(editor, commandName)

  return command != null ? (attrs ? command.canExec(attrs) : command.canExec()) : false
}

function getCommand(editor: Editor, commandName: string): CommandAction | null {
  const command = editor.commands[commandName]

  return typeof command === "function" ? command : null
}
