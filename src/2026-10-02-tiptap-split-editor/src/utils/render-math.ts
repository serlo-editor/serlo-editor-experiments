import { convertLatexToMarkup } from "mathlive"

import { MATH_ATTRIBUTE, MATH_BLOCK_ATTRIBUTE } from "@/components/math"

/**
 * Typesets the formulas of editor HTML, which carry their LaTeX as text, so
 * previews look like the editor (which renders them in a `<math-field>`
 * instead). Needs `mathlive/static.css`, imported in main.tsx.
 */
export function renderMathFields(html: string) {
  if (!html.includes(MATH_ATTRIBUTE)) return html
  const root = document.createElement("div")
  root.innerHTML = html
  root.querySelectorAll(`[${MATH_ATTRIBUTE}],[${MATH_BLOCK_ATTRIBUTE}]`).forEach((element) => {
    const isBlock = element.hasAttribute(MATH_BLOCK_ATTRIBUTE)
    element.innerHTML = convertLatexToMarkup(element.textContent ?? "", {
      // "math" is TeX's display style, "inline-math" its text style
      defaultMode: isBlock ? "math" : "inline-math",
    })
  })
  return root.innerHTML
}
