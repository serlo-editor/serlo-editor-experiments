import c from "highlight.js/lib/languages/c"
import css from "highlight.js/lib/languages/css"
import javascript from "highlight.js/lib/languages/javascript"
import plaintext from "highlight.js/lib/languages/plaintext"
import python from "highlight.js/lib/languages/python"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"

/**
 * The only languages we highlight, keeps highlight.js out of the bundle.
 * plaintext has to be registered as well, unregistered languages make lowlight
 * fall back to auto-detection.
 */
export const CODE_GRAMMARS = {
  c,
  css,
  javascript,
  plaintext,
  python,
  typescript,
  xml,
}

export const CODE_LANGUAGES = [
  { value: "plaintext", label: "Klartext" },
  { value: "xml", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "c", label: "C" },
]

const ALIASES: Record<string, string> = {
  html: "xml",
  htm: "xml",
  svg: "xml",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  text: "plaintext",
  txt: "plaintext",
  h: "c",
}

/** maps aliases (e.g. from the ```js input rule) onto our language values */
export function resolveLanguage(language?: string | null) {
  const name = language?.toLowerCase() ?? ""
  const resolved = ALIASES[name] ?? name
  return CODE_LANGUAGES.some((l) => l.value === resolved) ? resolved : "plaintext"
}
