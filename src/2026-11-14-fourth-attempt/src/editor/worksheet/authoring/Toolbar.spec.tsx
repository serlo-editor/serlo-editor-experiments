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
  expect(inlineMarkup).not.toContain('aria-label="Heading 1"')
  expect(inlineMarkup).not.toContain('aria-label="Bullet list"')
  expect(blockMarkup).toContain('aria-label="Heading 6"')
  expect(blockMarkup).toContain('aria-label="Bullet list"')
  expect(blockMarkup).toContain('aria-label="Numbered list"')
})

test("heading and list buttons format selected block and reflect active kind", async () => {
  const window = new Window()
  const globals = new Map<string, PropertyDescriptor | undefined>()
  for (const key of ["window", "document", "navigator", "Node", "HTMLElement"]) {
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
  try {
    render()
    button("Heading 2").click()
    expect(editor.getDocJSON().content?.[0]).toMatchObject({ type: "heading", attrs: { level: 2 } })
    render()
    expect(button("Heading 2").getAttribute("aria-pressed")).toBe("true")

    button("Bullet list").click()
    expect(editor.getDocJSON().content?.[0]).toMatchObject({
      type: "list",
      attrs: { kind: "bullet" },
    })
    render()
    expect(button("Bullet list").getAttribute("aria-pressed")).toBe("true")

    button("Numbered list").click()
    expect(editor.getDocJSON().content?.[0]).toMatchObject({
      type: "list",
      attrs: { kind: "ordered" },
    })
    render()
    expect(button("Numbered list").getAttribute("aria-pressed")).toBe("true")

    button("Paragraph").click()
    expect(editor.getDocJSON().content?.[0]).toMatchObject({ type: "paragraph" })
    render()
    expect(button("Paragraph").getAttribute("aria-pressed")).toBe("true")
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
