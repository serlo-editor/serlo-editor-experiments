import { expect, test } from "bun:test"

import { createRichTextEditor, richText } from "@editor/rich-text"
import { Window } from "happy-dom"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

import { Toolbar } from "./Toolbar"

test("shows only blocks available to focused editor", () => {
  const inline = createRichTextEditor({ definition: richText.inline({ marks: { bold: true } }) })
  const block = createRichTextEditor({
    definition: richText.block({ blocks: { paragraph: true, heading: true, bulletList: true } }),
  })

  const inlineMarkup = renderToStaticMarkup(<Toolbar editor={inline} />)
  const blockMarkup = renderToStaticMarkup(<Toolbar editor={block} />)
  expect(inlineMarkup).not.toContain('aria-label="Text style"')
  expect(inlineMarkup).not.toContain('aria-label="Bullet list"')
  expect(blockMarkup).toContain('aria-label="Text style"')
  expect(blockMarkup).toContain('value="6">Heading 6</option>')
  expect(blockMarkup).toContain('aria-label="Bullet list"')
  expect(blockMarkup).toContain('aria-label="Numbered list"')
})

test("style select and list buttons format selected block and reflect active kind", async () => {
  const window = new Window()
  const globals = new Map<string, PropertyDescriptor | undefined>()
  for (const key of ["window", "document", "navigator", "Node", "HTMLElement", "Event"]) {
    globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: Reflect.get(window, key),
    })
  }
  const editor = createRichTextEditor({
    definition: richText.block({
      blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
    }),
  })
  const host = document.createElement("div")
  const content = document.createElement("div")
  document.body.append(host, content)
  const root = createRoot(host)
  editor.mount(content)
  const render = () => flushSync(() => root.render(<Toolbar editor={editor} />))
  const button = (label: string) =>
    host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!
  const select = () => host.querySelector<HTMLSelectElement>('select[aria-label="Text style"]')!
  const chooseStyle = (value: string) => {
    select().value = value
    select().dispatchEvent(new Event("change", { bubbles: true }))
  }
  try {
    render()
    chooseStyle("2")
    expect(editor.getDocJSON().content?.[0]).toMatchObject({ type: "heading", attrs: { level: 2 } })
    render()
    expect(select().value).toBe("2")

    button("Bullet list").click()
    expect(editor.getDocJSON().content?.[0]).toMatchObject({
      type: "list",
      attrs: { kind: "bullet" },
    })
    render()
    expect(button("Bullet list").getAttribute("aria-pressed")).toBe("true")
    expect(select().value).toBe("bullet")

    button("Numbered list").click()
    expect(editor.getDocJSON().content?.[0]).toMatchObject({
      type: "list",
      attrs: { kind: "ordered" },
    })
    render()
    expect(button("Numbered list").getAttribute("aria-pressed")).toBe("true")

    expect(select().value).toBe("ordered")
    chooseStyle("3")
    expect(editor.getDocJSON().content?.[0]).toMatchObject({ type: "heading", attrs: { level: 3 } })
    render()
    expect(select().value).toBe("3")

    chooseStyle("paragraph")
    expect(editor.getDocJSON().content?.[0]).toMatchObject({ type: "paragraph" })
    render()
    expect(select().value).toBe("paragraph")
  } finally {
    flushSync(() => root.unmount())
    editor.unmount()
    await window.happyDOM.close()
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
