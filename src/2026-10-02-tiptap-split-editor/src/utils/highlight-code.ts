import hljs from "highlight.js/lib/core"

import { CODE_GRAMMARS, resolveLanguage } from "@/utils/code-languages"

for (const [name, grammar] of Object.entries(CODE_GRAMMARS)) {
  hljs.registerLanguage(name, grammar)
}

/**
 * Adds highlight.js markup to the code blocks of editor HTML, so previews look
 * like the editor (which highlights via lowlight decorations instead).
 */
export function highlightCodeBlocks(html: string) {
  if (!html.includes("<pre")) return html
  const root = document.createElement("div")
  root.innerHTML = html
  root.querySelectorAll("pre code").forEach((element) => {
    const className = element.getAttribute("class") ?? ""
    const language = resolveLanguage(/language-([\w-]+)/.exec(className)?.[1])
    if (language === "plaintext") return
    element.innerHTML = hljs.highlight(element.textContent ?? "", {
      language,
      ignoreIllegals: true,
    }).value
  })
  return root.innerHTML
}
