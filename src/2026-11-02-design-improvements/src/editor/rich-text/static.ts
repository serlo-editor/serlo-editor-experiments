import { renderMath } from "./math.ts"
import { boxTypeLabel } from "./titled-block.ts"

/**
 * Finishes serialized rich text for learners: the document keeps formulas as TeX, spoilers
 * as plain blocks and box types as attributes, while node views render them in the editor.
 */
export function renderStaticRichText(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>(".prosemirror-math-inline, .prosemirror-math-block")
    .forEach((element) => {
      const isBlock = element.classList.contains("prosemirror-math-block")
      const text = element.textContent ?? ""
      element.replaceChildren()
      renderMath(text, element, isBlock)
    })

  root.querySelectorAll<HTMLElement>("div.spoiler").forEach((spoiler) => {
    const details = document.createElement("details")
    details.className = "spoiler"
    const summary = document.createElement("summary")
    summary.className = "spoiler__title"
    const title = spoiler.querySelector(":scope > .spoiler__title")
    summary.append(...(title?.childNodes ?? []))
    if (!summary.textContent?.trim()) summary.textContent = "Spoiler"
    const content = spoiler.querySelector(":scope > .spoiler__content")
    details.append(summary, ...(content ? [content] : []))
    spoiler.replaceWith(details)
  })

  root.querySelectorAll<HTMLElement>("div.box").forEach((box) => {
    const title = box.querySelector(":scope > .box__title")
    if (!title) return
    const label = box.dataset.box === "blank" ? "" : boxTypeLabel(box.dataset.box ?? "")
    if (label) {
      const badge = document.createElement("span")
      badge.className = "box__badge"
      badge.textContent = label
      title.prepend(badge)
    } else if (!title.textContent?.trim()) {
      title.remove()
    }
  })
}
