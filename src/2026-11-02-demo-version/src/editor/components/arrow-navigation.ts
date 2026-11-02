import type { Command } from "prosekit/pm/state"
import type { KeyboardEvent } from "react"

/** marks the container whose fields are navigated with ArrowUp/ArrowDown */
export const ARROW_NAV_ATTRIBUTE = "data-arrow-nav"

// single line inputs and rich-text editors, in DOM order
const fieldSelector = [
  'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([disabled])',
  '.ProseMirror[contenteditable="true"]',
].join(",")

export type Direction = -1 | 1

/**
 * Attach as `onKeyDown` to the container: ArrowUp/ArrowDown in a text input move focus to
 * the previous/next field. Rich-text editors handle the keys themselves, see `leaveAtEdge`.
 */
export function handleArrowKeyNavigation(event: KeyboardEvent<HTMLElement>) {
  const direction = plainArrowDirection(event)
  if (!direction) return
  const { target } = event
  // number inputs step their value with the arrow keys
  if (!(target instanceof HTMLInputElement) || target.type === "number") return
  if (focusAdjacentField(target, direction)) event.preventDefault()
}

/** Keymap command leaving the editor when the caret is on its first/last line. */
export function leaveAtEdge(direction: Direction): Command {
  return (state, _dispatch, view) => {
    if (!view?.endOfTextblock(direction === -1 ? "up" : "down")) return false
    const { $from } = state.selection
    const [from, to] =
      direction === -1
        ? [0, $from.before($from.depth)]
        : [$from.after($from.depth), state.doc.content.size]
    let hasOtherTextblock = false
    if (from < to) {
      state.doc.nodesBetween(from, to, (node) => {
        if (node.isTextblock) hasOtherTextblock = true
        return !hasOtherTextblock
      })
    }
    return !hasOtherTextblock && focusAdjacentField(view.dom, direction)
  }
}

function plainArrowDirection(event: KeyboardEvent): Direction | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null
  if (event.key === "ArrowUp") return -1
  if (event.key === "ArrowDown") return 1
  return null
}

/** Moves focus from `field` to the previous/next field of the surrounding container. */
function focusAdjacentField(field: HTMLElement, direction: Direction) {
  const container = field.closest<HTMLElement>(`[${ARROW_NAV_ATTRIBUTE}]`)
  if (!container) return false
  const fields = Array.from(container.querySelectorAll<HTMLElement>(fieldSelector))
  const next = fields[fields.indexOf(field) + direction]
  if (!next || !fields.includes(field)) return false

  next.focus()
  if (next instanceof HTMLInputElement) {
    // coming from above lands at the start, from below at the end
    const caret = direction === 1 ? 0 : next.value.length
    if (next.type !== "number") next.setSelectionRange(caret, caret)
  } else {
    // contenteditable: place the caret at the near edge, ProseMirror picks up the DOM selection
    const range = document.createRange()
    range.selectNodeContents(next)
    range.collapse(direction === 1)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  next.scrollIntoView({ block: "nearest" })
  return true
}
