import { padStart } from "es-toolkit/compat"
import { useId, useReducer } from "react"

import type { CDRT } from "../editor"
import type { FlatNode } from "../editor/nodes/flat"
import * as F from "../editor/nodes/flat"
import { load } from "../editor/operations/load"
import type { Key } from "../editor/store/key"
import { useEditorStore } from "../editor/store/use-editor-store"

export interface DebugPanelProps<T extends string> {
  name: string
  labels: Record<T, string>
  getCurrentValue: Record<T, () => string>
  showOnStartup: Record<T, boolean>
}

/**
 * A debug panel component that allows toggling the visibility of various debug information.
 */
export function DebugPanel<T extends string>({
  name,
  labels,
  getCurrentValue,
  showOnStartup,
}: DebugPanelProps<T>) {
  const panelId = useId()
  const [show, toggleOption] = useReducer(
    (prev, key: T) => ({ ...prev, [key]: !prev[key] }),
    showOnStartup,
  )
  const options = Object.keys(labels) as T[]

  return (
    <>
      <h2 id={`${panelId}-header`}>Debug Panel: {name}</h2>
      <fieldset aria-labelledby={`${panelId}-header`} className="debug-panel__options surface">
        <legend>Options</legend>
        {options.map((option) => (
          <label key={option} htmlFor={`${panelId}-${option}-toggle`}>
            <input
              id={`${panelId}-${option}-toggle`}
              type="checkbox"
              checked={show[option]}
              aria-checked={show[option]}
              onChange={() => toggleOption(option)}
            />{" "}
            {labels[option]}
          </label>
        ))}
      </fieldset>
      <div className="debug-panel__values">
        {options.map((option) =>
          show[option] ? (
            <pre
              key={option}
              className="debug-panel__value surface"
              role="log"
              aria-label={`Debug info for ${labels[option]}`}
              aria-live="off"
            >
              {getCurrentValue[option]()}
            </pre>
          ) : null,
        )}
      </div>
    </>
  )
}

const ROOT_KEY = "root" as Key

export function EditorDebugPanel({ cdrt }: { cdrt: CDRT }) {
  const { store } = useEditorStore(cdrt)

  const getCurrentValue = {
    json: () => {
      if (!store.has(ROOT_KEY)) return "Loading..."

      const jsonValue = load({ store, node: store.get(ROOT_KEY) })
      return JSON.stringify(jsonValue, null, 2)
    },
    entries: () => {
      const stringifyEntry = ([key, entry]: [string, FlatNode]) => {
        const value = F.isRichText(entry) ? store.getEditor(entry).state.doc.toJSON() : entry.value

        return `${padStart(key, 4)}: ${JSON.stringify(value)}`
      }

      const lines = store.getEntries().map(stringifyEntry)

      lines.sort()

      return lines.join("\n")
    },
    selection: () => JSON.stringify(store.selection, null, 2),
  }

  return (
    <DebugPanel
      name={cdrt.name}
      labels={{
        json: "External JSON value",
        entries: "Internal flat nodes",
        selection: "Current selection",
      }}
      showOnStartup={{ json: true, entries: false, selection: true }}
      getCurrentValue={getCurrentValue}
    />
  )
}
