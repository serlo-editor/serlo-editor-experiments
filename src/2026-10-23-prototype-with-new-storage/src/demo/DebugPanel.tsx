import { useId, useState } from "react"

import { exportContent } from "./content.tsx"
import type { LocalSelection } from "./RichTextField.tsx"
import type { PrototypeSession } from "./session.ts"

type DebugOption = "json" | "export" | "structure" | "selection"
const options: { key: DebugOption; label: string }[] = [
  { key: "json", label: "Document JSON" },
  { key: "export", label: "Content export" },
  { key: "structure", label: "Unit / field structure" },
  { key: "selection", label: "Current selection" },
]

export function EditorDebugPanel({
  session,
  selection,
}: {
  session: PrototypeSession
  selection: LocalSelection | null
}) {
  const panelId = useId()
  const [show, setShow] = useState<Record<DebugOption, boolean>>({
    json: true,
    export: false,
    structure: false,
    selection: true,
  })
  const values = {
    json: () => session.document.snapshot(),
    export: () => exportContent(session.document.snapshot()),
    structure: () => describeStructure(session),
    selection: () => selection,
  }

  return (
    <>
      <h2 id={`${panelId}-header`}>Debug: {session.name}</h2>
      <fieldset aria-labelledby={`${panelId}-header`} className="debug-panel__options surface">
        <legend>Options</legend>
        {options.map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={show[key]}
              onChange={() => setShow((previous) => ({ ...previous, [key]: !previous[key] }))}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="debug-panel__values">
        {options.map(({ key, label }) =>
          show[key] ? (
            <pre
              key={key}
              className="debug-panel__value surface"
              role="log"
              aria-label={label}
              aria-live="off"
            >
              {JSON.stringify(values[key](), null, 2)}
            </pre>
          ) : null,
        )}
      </div>
    </>
  )
}

function describeStructure(session: PrototypeSession) {
  const root = session.document.root
  return {
    id: root.id,
    type: root.type,
    items: root.field("items").map((item) => ({
      id: item.id,
      type: item.type,
      fields:
        item.type === "multiple-choice"
          ? {
              question: { editorId: item.field("question").id },
              options: item.field("options").map((option) => ({
                isCorrect: option.field("isCorrect").get(),
                text: { editorId: option.field("text").id },
              })),
            }
          : { content: { editorId: item.field("content").id } },
    })),
  }
}
