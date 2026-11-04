import { defineCommands, type Extension, union } from "prosekit/core"
import { defineMath as defineProseKitMath } from "prosekit/extensions/math"
import { type Command, TextSelection } from "prosekit/pm/state"
import temml from "temml"

/** Formulas typed as TeX, shown typeset unless the cursor is inside them. */
export function defineMath(): Extension {
  return union(
    defineProseKitMath({
      renderMathInline: (text, element) => renderMath(text, element, false),
      renderMathBlock: (text, element) => renderMath(text, element, true),
    }),
    defineCommands({ insertMath: () => insertMathInline }),
  )
}

/** Typesets TeX into an element as MathML; shows the source when it does not parse. */
export function renderMath(text: string, element: HTMLElement, displayMode: boolean) {
  if (!text.trim()) {
    element.textContent = displayMode ? "Formel" : "ƒ"
    element.classList.add("math-empty")
    return
  }
  element.classList.remove("math-empty")
  temml.render(text, element, { displayMode, throwOnError: false })
}

/** Turns the selected text into a formula, or starts an empty one at the cursor. */
const insertMathInline: Command = (state, dispatch) => {
  const type = state.schema.nodes.mathInline
  if (!type) return false
  const { from, to } = state.selection
  const text = state.doc.textBetween(from, to)
  const node = type.create(null, text ? state.schema.text(text) : null)
  if (dispatch) {
    const tr = state.tr.replaceSelectionWith(node)
    // place the cursor at the end of the formula source, which shows it for editing
    tr.setSelection(TextSelection.create(tr.doc, from + 1 + text.length))
    dispatch(tr.scrollIntoView())
  }
  return true
}
