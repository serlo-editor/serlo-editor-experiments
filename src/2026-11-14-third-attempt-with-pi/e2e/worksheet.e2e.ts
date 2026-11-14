import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const dist = join(import.meta.dir, "../dist")
await mkdir(dist, { recursive: true })
const directory = await mkdtemp(join(dist, "worksheet-e2e-"))
const modes = '[aria-label="Arbeitsmodus"]'
let view: Bun.WebView

beforeAll(async () => {
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
        : {
            type: "chrome",
            url: false,
            argv: ["--no-sandbox", "--disable-dev-shm-usage"],
          },
    console,
  })
  await view.navigate(pathToFileURL(join(directory, "index.html")).href)
  await expectPage('document.querySelectorAll(".editor-card").length', 1)
}, 30_000)

test("switches stores via snapshots, grades, and resets downstream data", async () => {
  const introduction = ".exercise--text .ProseMirror"
  await click(introduction, 3)
  await view.type("Gemeinsam lernen.")
  await expectPage(
    `document.querySelector(${JSON.stringify(introduction)}).textContent`,
    "Gemeinsam lernen.",
  )
  await expectPage(
    'Array.from(document.querySelectorAll(".toolbar button"), button => button.textContent)',
    ["Fett", "Kursiv"],
  )
  await click(".exercise--fill-blank .ProseMirror")
  await expectPage(
    'Array.from(document.querySelectorAll(".toolbar button"), button => button.textContent)',
    ["Fett", "Kursiv", "Gap"],
  )
  await click(".multiple-choice-options li:first-child input")

  await click(`${modes} button:nth-child(2)`)
  await expectPage('document.querySelectorAll(".ProseMirror").length', 0)
  await expectPage('document.querySelector(".preview-gap").value', "")
  await click(".preview-gap")
  await view.type("Paris")
  await expectPage('document.querySelector(".preview-gap").value', "Paris")
  await click(".choice-card:first-child input")
  await click(".choice-card:nth-child(2) input")

  await click(`${modes} button:nth-child(3)`)
  await expectPage(
    'Array.from(document.querySelectorAll(".feedback-card[data-result]"), el => el.dataset.result)',
    ["correct", "correct"],
  )
  await view.evaluate(`(() => {
    const select = document.querySelector('.exercise--fill-blank select');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, 'partial');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  await expectPage(
    'document.querySelector(".exercise--fill-blank .feedback-card").dataset.result',
    "partial",
  )
  await click(".exercise--fill-blank .feedback-card .ProseMirror")
  await view.type("Gut gemacht!")
  await click('[aria-label="Gesamtfeedback"] .ProseMirror')
  await view.type("Weiter so.")
  await click(`${modes} button:nth-child(4)`)
  await expectPage('document.querySelectorAll(".ProseMirror").length', 0)
  await expectPage(
    'document.querySelector(".worksheet > .feedback-card").textContent.includes("Weiter so.")',
    true,
  )
  await expectPage('document.querySelector(".preview-gap").disabled', true)
  await expectPage('document.querySelector(".choice-card input").disabled', true)
  await expectPage(
    'document.querySelector(".exercise--fill-blank .feedback-card").dataset.result',
    "partial",
  )
  const before = await view.evaluate(
    'document.querySelectorAll(".document-json pre")[2].textContent',
  )
  await click(`${modes} button:nth-child(4)`)
  await expectPage('document.querySelectorAll(".document-json pre")[2].textContent', before)

  await click(`${modes} button:nth-child(2)`)
  await expectPage('document.querySelector(".preview-gap").value', "Paris")
  await expectPage('document.querySelectorAll(".feedback-card").length', 0)
  await click(`${modes} button:nth-child(3)`)
  await expectPage(
    'document.querySelector(".exercise--fill-blank .feedback-card").dataset.result',
    "correct",
  )
  await expectPage(
    'document.querySelector(".exercise--fill-blank .feedback-card .ProseMirror").textContent',
    "",
  )

  await click(`${modes} button:first-child`)
  await expectPage(
    `document.querySelector(${JSON.stringify(introduction)}).textContent`,
    "Gemeinsam lernen.",
  )
  await click(`${modes} button:nth-child(2)`)
  await expectPage('document.querySelector(".preview-gap").value', "")
  await expectPage('document.querySelector(".choice-card:first-child input").checked', false)
  await click(`${modes} button:nth-child(3)`)
  await expectPage(
    'Array.from(document.querySelectorAll(".feedback-card[data-result]"), el => el.dataset.result)',
    ["incorrect", "incorrect"],
  )
}, 30_000)

test("feedback grades unanswered exercises without writing answers", async () => {
  await click(`${modes} button:nth-child(3)`)
  await expectPage(
    'Array.from(document.querySelectorAll(".feedback-card[data-result]"), el => el.dataset.result)',
    ["incorrect", "incorrect"],
  )
  await click(`${modes} button:nth-child(4)`)
  await expectPage('document.querySelectorAll(".feedback-card[data-result]").length', 2)
  await expectPage('document.querySelector(".preview-gap").disabled', true)
  await expectPage('JSON.parse(document.querySelectorAll(".document-json pre")[1].textContent)', {})
}, 30_000)

async function click(selector: string, clickCount: 1 | 2 | 3 = 1) {
  await view.scrollTo(selector, { timeout: 5000 })
  await view.click(selector, { clickCount, timeout: 5000 })
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
