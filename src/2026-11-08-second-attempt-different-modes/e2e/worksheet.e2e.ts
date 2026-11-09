import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// Build inside the project so the browser can load the bundled file URL.
const dist = join(import.meta.dir, "../dist")
await mkdir(dist, { recursive: true })
const directory = await mkdtemp(join(dist, "worksheet-e2e-"))
const first = '[aria-label="Editor 1"]'
const second = '[aria-label="Editor 2"]'
const modes = '[aria-label="Arbeitsmodus"]'
const panes = '[aria-label="Rechter Bereich"]'
let view: Bun.WebView

beforeAll(async () => {
  // Self-contained HTML tests the bundled app without a server or reserved port.
  const build = await Bun.build({
    entrypoints: [join(import.meta.dir, "../src/index.html")],
    target: "browser",
    compile: true,
    outdir: directory,
  })
  if (!build.success) throw new AggregateError(build.logs, "E2E app build failed")
}, 30_000)
afterAll(() => rm(directory, { recursive: true, force: true }))
afterEach(() => view?.close())
beforeEach(async () => {
  view = new Bun.WebView({
    width: 1440,
    height: 1000,
    backend:
      process.platform === "darwin"
        ? "webkit"
        : { type: "chrome", url: false, argv: ["--no-sandbox", "--disable-dev-shm-usage"] },
    console,
  })
  await view.navigate(pathToFileURL(join(directory, "index.html")).href)
  await expectElements(".editor-card", "ariaLabel", ["Editor 1", "Editor 2"])
}, 30_000)

test("authors and solves collaboratively without changing authored content", async () => {
  const introduction = ".editor-content > .ProseMirror"
  await click(`${first} ${introduction}`, 3)
  await view.type("Gemeinsam lernen.")
  await expectElements(introduction, "textContent", ["Gemeinsam lernen.", "Gemeinsam lernen."])
  await click(`${first} .multiple-choice-options li:first-child input`)
  await expectElements(".multiple-choice-options li:first-child input", "checked", [true, true])

  await click(`${panes} button:nth-child(2)`)
  const content = await view.evaluate('document.querySelector(".document-json pre").textContent')
  await click(`${panes} button:first-child`)
  await click(`${modes} button:nth-child(2)`)
  await expectElements(".ProseMirror", "textContent", [])
  await expectElements(".preview-gap", "value", ["", ""])

  await click(`${first} .preview-gap`)
  await view.type("Par")
  await expectElements(".preview-gap", "value", ["Par", "Par"])
  // A remote rerender must not replace the focused input or lose its caret.
  await view.type("is")
  await expectElements(".preview-gap", "value", ["Paris", "Paris"])
  await click(`${second} .preview-gap`, 3)
  await view.type("paris")
  await expectElements(".preview-gap", "value", ["paris", "paris"])
  await click(`${second} .choice-card:nth-child(2) input`)
  await click(`${first} .choice-card:first-child input`)
  await expectElements(".choice-card input", "checked", [true, true, false, true, true, false])

  await click(`${panes} button:nth-child(2)`)
  await expectElements(".document-json:first-of-type pre", "textContent", [content])
  await click(`${modes} button:nth-child(3)`)
  await expectResults(["correct", "correct", "correct", "correct"])
}, 30_000)

test("grades answers, syncs formatted feedback, and preserves overrides across viewing", async () => {
  await click(`${modes} button:nth-child(2)`)
  await typeInto(`${first} .preview-gap`, "Lyon")
  await click(`${second} .choice-card:nth-child(2) input`)
  await click(`${modes} button:nth-child(3)`)
  await expectResults(["incorrect", "correct", "incorrect", "correct"])
  await expectElements(".preview-gap, .choice-card input", "disabled", Array(8).fill(true))

  await click(`${first} .exercise--fill-blank select`)
  await view.press("Home")
  for (let index = 0; index < 3; index++) await view.press("ArrowDown")
  await view.press("Enter")
  await expectResults(["partial", "correct", "partial", "correct"])

  await click(`${first} .exercise--fill-blank .ProseMirror`)
  await click(`${first} [aria-label="Toggle Bold"]`)
  await view.type("Fast richtig.")
  await expectElements(".exercise--fill-blank .ProseMirror strong", "textContent", [
    "Fast richtig.",
    "Fast richtig.",
  ])
  await typeInto(`${second} [aria-label="Gesamtfeedback"] .ProseMirror`, "Weiter üben.")
  await expectElements('[aria-label="Gesamtfeedback"] .ProseMirror', "textContent", [
    "Weiter üben.",
    "Weiter üben.",
  ])

  await click(`${modes} button:nth-child(4)`)
  await expectResults(["partial", "correct", "partial", "correct"])
  await expectElements(".ProseMirror, .feedback-card select, .toolbar", "textContent", [])
  await expectElements(".preview-gap, .choice-card input", "disabled", Array(8).fill(true))
  await expectElements(".exercise--fill-blank .preview-rich-text strong", "textContent", [
    "Fast richtig.",
    "Fast richtig.",
  ])
  await expectElements(".learner-content > .feedback-card .preview-rich-text", "textContent", [
    "Weiter üben.",
    "Weiter üben.",
  ])

  await click(`${modes} button:nth-child(3)`)
  await expectResults(["partial", "correct", "partial", "correct"])
  await click(`${first} .exercise--fill-blank select`)
  await view.press("Home")
  await view.press("Enter")
  await expectResults(["incorrect", "correct", "incorrect", "correct"])
  await expectElements(".exercise--fill-blank .ProseMirror strong", "textContent", [
    "Fast richtig.",
    "Fast richtig.",
  ])
}, 30_000)

test("mode switches recreate editors without clearing answers or feedback", async () => {
  await click(`${modes} button:nth-child(2)`)
  await typeInto(`${first} .preview-gap`, "Paris")
  await click(`${second} .choice-card:nth-child(2) input`)
  await click(`${modes} button:nth-child(2)`)
  await expectElements(".preview-gap", "value", ["Paris", "Paris"])
  await click(`${modes} button:nth-child(3)`)
  await expectResults(["correct", "correct", "correct", "correct"])
  await typeInto(`${first} .exercise--fill-blank .ProseMirror`, "Gut gemacht!")
  await typeInto(`${second} [aria-label="Gesamtfeedback"] .ProseMirror`, "Weiter so.")
  await click(`${first} .exercise--fill-blank select`)
  await view.press("End")
  await view.press("Enter")
  await click(`${modes} button:nth-child(3)`)
  await expectResults(["incorrect", "correct", "incorrect", "correct"])
  await expectElements(".exercise--fill-blank .ProseMirror", "textContent", [
    "Gut gemacht!",
    "Gut gemacht!",
  ])

  await click(`${modes} button:nth-child(4)`)
  await expectResults(["incorrect", "correct", "incorrect", "correct"])
  await expectElements(".exercise--fill-blank .feedback-card .preview-rich-text", "textContent", [
    "Gut gemacht!",
    "Gut gemacht!",
  ])
  await click(`${modes} button:nth-child(2)`)
  await expectElements(".preview-gap", "value", ["Paris", "Paris"])
  await expectElements(".choice-card:nth-child(2) input", "checked", [true, true])
  await expectElements(".feedback-card", "textContent", [])

  await click(`${modes} button:first-child`)
  await expectElements(".editor-content > .ProseMirror", "textContent", [
    "This is an example of educational content with various types of items.",
    "This is an example of educational content with various types of items.",
  ])
  await click(`${modes} button:nth-child(2)`)
  await expectElements(".preview-gap", "value", ["Paris", "Paris"])
  await expectElements(".choice-card:nth-child(2) input", "checked", [true, true])
  await click(`${modes} button:nth-child(3)`)
  await expectResults(["incorrect", "correct", "incorrect", "correct"])
  await expectElements(".exercise--fill-blank .ProseMirror", "textContent", [
    "Gut gemacht!",
    "Gut gemacht!",
  ])
  await expectElements('[aria-label="Gesamtfeedback"] .ProseMirror', "textContent", [
    "Weiter so.",
    "Weiter so.",
  ])
}, 30_000)

async function typeInto(selector: string, text: string) {
  await click(selector)
  await view.type(text)
}

async function click(selector: string, clickCount: 1 | 2 | 3 = 1) {
  await view.scrollTo(selector, { timeout: 5000 })
  await view.click(selector, { clickCount, timeout: 5000 })
}

async function expectResults(results: string[]) {
  await expectPage(
    'Array.from(document.querySelectorAll(".feedback-card[data-result]"), element => element.dataset.result)',
    results,
  )
}

async function expectElements(selector: string, property: string, expected: unknown[]) {
  await expectPage(
    `Array.from(document.querySelectorAll(${JSON.stringify(selector)}), element => {
      if (${JSON.stringify(property)} !== "textContent") return element[${JSON.stringify(property)}];
      // Presence labels are decorations, not authored text.
      const copy = element.cloneNode(true);
      copy.querySelectorAll(".ProseMirror-yjs-cursor").forEach(cursor => cursor.remove());
      return copy.textContent;
    })`,
    expected,
  )
}

async function expectPage(expression: string, expected: unknown) {
  const deadline = performance.now() + 5000
  let actual: unknown
  do {
    actual = await view.evaluate(expression)
    if (Bun.deepEquals(actual, expected)) break
    await Bun.sleep(25)
  } while (performance.now() < deadline)
  expect(actual, expression).toEqual(expected)
}
