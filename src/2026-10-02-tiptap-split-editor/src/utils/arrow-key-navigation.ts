import type { KeyboardEvent } from "react"

/** marks the form whose fields are navigated with ArrowUp/ArrowDown */
export const ARROW_NAV_ATTRIBUTE = "data-arrow-nav"

// single line inputs and tiptap editors, in DOM order
const selector = [
  'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([disabled])',
  '.ProseMirror[contenteditable="true"]',
].join(",")

export type Direction = -1 | 1

export function isPlainArrowKey(event: {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}): Direction | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null
  if (event.key === "ArrowUp") return -1
  if (event.key === "ArrowDown") return 1
  return null
}

/**
 * Moves focus from `field` to the previous/next field of the surrounding
 * form. Returns false when there is none.
 */
export function focusAdjacentField(field: HTMLElement, direction: Direction) {
  const container = field.closest<HTMLElement>(`[${ARROW_NAV_ATTRIBUTE}]`)
  if (!container) return false
  const fields = Array.from(container.querySelectorAll<HTMLElement>(selector))
  const index = fields.indexOf(field)
  if (index === -1) return false
  const next = fields[index + direction]
  if (!next) return false

  next.focus()
  if (next instanceof HTMLInputElement) {
    // coming from above lands at the start, from below at the end
    const caret = direction === 1 ? 0 : next.value.length
    next.setSelectionRange(caret, caret)
  } else {
    // contenteditable: place the caret at the near edge, ProseMirror picks up
    // the DOM selection
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

/**
 * Attach as `onKeyDown` to the form container: ArrowUp/ArrowDown in a text
 * input move focus to the previous/next field. Tiptap editors handle the
 * keys themselves, see the rich text editor.
 */
export function handleArrowKeyNavigation(event: KeyboardEvent<HTMLElement>) {
  const direction = isPlainArrowKey(event)
  if (!direction) return
  if (!(event.target instanceof HTMLInputElement)) return
  if (focusAdjacentField(event.target, direction)) event.preventDefault()
}
