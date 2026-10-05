import clsx from "clsx"
import { type CommandAction, type Editor, isMarkActive } from "prosekit/core"

import * as F from "../nodes/flat"
import type { EditorStore } from "../store/editor-store"

export function Toolbar({ store }: { store: EditorStore }) {
  const editor = getFocusedEditor(store)
  const canToggleGap = canExecCommand(editor, "toggleGap")

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting controls">
      <ToolbarButton
        label="Toggle Bold"
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

function getFocusedEditor(store: EditorStore): Editor | null {
  const selectionKey = store.selection?.key

  if (selectionKey == null || !store.has(selectionKey)) return null

  const node = store.get(selectionKey)

  return F.isRichText(node) ? store.getEditor(node) : null
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
    "toolbar__button",
    canExec ? "toolbar__button--enabled" : "toolbar__button--disabled",
    isActive ? "toolbar__button--active" : "toolbar__button--idle",
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

function isMarkActiveInEditor(editor: Editor | null, markName: string): boolean {
  if (editor == null) return false
  if (!(markName in editor.schema.marks)) return false

  return isMarkActive(editor.state, markName)
}

function execCommand(editor: Editor | null, commandName: string): void {
  if (editor == null) return

  const command = getCommand(editor, commandName)

  if (command != null) {
    command()
  }
}

function canExecCommand(editor: Editor | null, commandName: string): boolean {
  if (editor == null) return false

  const command = getCommand(editor, commandName)

  return command != null ? command.canExec() : false
}

function getCommand(editor: Editor, commandName: string): CommandAction | null {
  const command = editor.commands[commandName]

  return typeof command === "function" ? command : null
}
