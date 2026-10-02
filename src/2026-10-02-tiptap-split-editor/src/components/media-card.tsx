import { NodeViewWrapper } from "@tiptap/react"
import { Plus, Trash2 } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"

import { cn } from "@/utils/cn"

/** one piece of media on the card: what it shows and the link it comes from */
export type MediaEntry = {
  thumbnail: ReactNode
  value: string
  /** what is wrong with the URL, shown under the field */
  hint?: string
  onChange: (value: string) => void
  /** removes this entry, or the whole block when it is the only one */
  onRemove: () => void
}

/**
 * What block media (an image, a video) shows in the editor instead of itself:
 * a thumbnail per entry, the URL it comes from and a button to remove it. The
 * editor stays a text editor that way, the previews show the real thing.
 * More than one entry is a gallery, `onAdd` is what grows it.
 */
export function MediaCard({
  label,
  entries,
  placeholder,
  selected,
  addLabel,
  onAdd,
}: {
  label: string
  entries: MediaEntry[]
  placeholder: string
  selected: boolean
  /** the text on the button that appends an entry, none: no button */
  addLabel?: string
  onAdd?: () => void
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const count = useRef(0)

  // media is inserted without a link, so the new field is where to continue
  useEffect(() => {
    const isNew = count.current === 0 ? !entries[0]?.value : entries.length > count.current
    count.current = entries.length
    if (isNew) inputs.current[entries.length - 1]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length])

  return (
    <NodeViewWrapper
      className={cn("media-card", selected && "media-selected")}
      contentEditable={false}
    >
      {entries.map((entry, index) => {
        // a gallery numbers its images, a single one needs no number
        const entryLabel = entries.length > 1 ? `${label} ${index + 1}` : label
        return (
          <div key={index} className="media-row">
            <span className="media-thumbnail">{entry.thumbnail}</span>
            <label className="media-fields">
              <span className="media-label">{entryLabel}</span>
              <input
                ref={(element) => {
                  inputs.current[index] = element
                }}
                type="url"
                value={entry.value}
                placeholder={placeholder}
                onChange={(event) => entry.onChange(event.target.value)}
                className="media-input"
              />
              {entry.hint && <span className="media-hint">{entry.hint}</span>}
            </label>
            <button
              type="button"
              title={`${entryLabel} löschen`}
              aria-label={`${entryLabel} löschen`}
              onClick={entry.onRemove}
              className="media-delete"
            >
              <Trash2 />
            </button>
          </div>
        )
      })}
      {onAdd && (
        <button type="button" onClick={onAdd} className="media-add">
          <Plus />
          {addLabel ?? label}
        </button>
      )}
    </NodeViewWrapper>
  )
}
