import {
  faBold,
  faItalic,
  faListOl,
  faListUl,
  faPuzzlePiece,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import clsx from "clsx"
import { type CommandAction, type Editor, isMarkActive } from "prosekit/core"
import { useState, type ReactNode } from "react"

import styles from "./Toolbar.module.css"

export function Toolbar({ editor }: { editor: Editor | null }) {
  const [, setRevision] = useState(0)
  const canToggleGap = canExecCommand(editor, "toggleGap")
  const listKind =
    editor && ["bullet", "ordered"].find((kind) => isNodeActiveInEditor(editor, "list", { kind }))
  const headingLevel =
    editor && [1, 2, 3, 4, 5, 6].find((level) => isNodeActiveInEditor(editor, "heading", { level }))
  const style = listKind ?? (headingLevel ? String(headingLevel) : "paragraph")

  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Formatting controls"
      onClick={() => setRevision((revision) => revision + 1)}
    >
      {editor?.schema.nodes.paragraph && (
        <select
          className={styles.select}
          aria-label="Text style"
          value={style}
          onChange={(event) => {
            const value = event.currentTarget.value
            execCommand(editor, "unwrapList")
            if (value === "paragraph") execCommand(editor, "setParagraph")
            else execCommand(editor, "setHeading", { level: Number(value) })
            setRevision((revision) => revision + 1)
          }}
        >
          <option value="paragraph">Text</option>
          {editor.schema.nodes.heading &&
            [1, 2, 3, 4, 5, 6].map((level) => (
              <option key={level} value={level}>
                Heading {level}
              </option>
            ))}
          {listKind && (
            <option value={listKind} disabled>
              {listKind === "bullet" ? "Bullet list" : "Numbered list"}
            </option>
          )}
        </select>
      )}
      {editor?.schema.nodes.list &&
        [
          { kind: "bullet", label: "Bullet list", icon: faListUl },
          { kind: "ordered", label: "Numbered list", icon: faListOl },
        ].map(({ kind, label, icon }) => (
          <ToolbarButton
            key={kind}
            label={label}
            isActive={isNodeActiveInEditor(editor, "list", { kind })}
            canExec={canExecCommand(editor, "toggleList", { kind })}
            onClick={() => execCommand(editor, "toggleList", { kind })}
          >
            <FontAwesomeIcon icon={icon} />
          </ToolbarButton>
        ))}
      <ToolbarButton
        label="Bold"
        isActive={isMarkActiveInEditor(editor, "bold")}
        canExec={canExecCommand(editor, "toggleBold")}
        onClick={() => execCommand(editor, "toggleBold")}
      >
        <FontAwesomeIcon icon={faBold} />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        isActive={isMarkActiveInEditor(editor, "italic")}
        canExec={canExecCommand(editor, "toggleItalic")}
        onClick={() => execCommand(editor, "toggleItalic")}
      >
        <FontAwesomeIcon icon={faItalic} />
      </ToolbarButton>
      {canToggleGap ? (
        <ToolbarButton
          label="Gap"
          isActive={isMarkActiveInEditor(editor, "gap")}
          canExec={canToggleGap}
          onClick={() => execCommand(editor, "toggleGap")}
        >
          <FontAwesomeIcon icon={faPuzzlePiece} />
        </ToolbarButton>
      ) : null}
    </div>
  )
}

function ToolbarButton({
  label,
  children,
  canExec,
  isActive,
  onClick,
}: {
  label: string
  children: ReactNode
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
      {children}
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
