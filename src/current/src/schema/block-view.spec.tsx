import { expect, test } from "bun:test"

import { Window } from "happy-dom"
import { useId, useState } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { createDocument } from "./document.ts"
import { array, blockUnion, object, optional, string, block, BlockView } from "./index.ts"

describeWithStores("BlockView", (getStore) => {
  test("remounts renderer state when a same-type child is replaced", async () => {
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
    const host = document.createElement("div")
    document.body.append(host)
    const reactRoot = createRoot(host)
    try {
      const text = block({
        type: "text",
        fields: { text: string() },
        render: function TextView({ value }) {
          const [mountedId] = useState(value.id)
          return (
            <p>
              {mountedId}:{value.field("text").get()}
            </p>
          )
        },
      })
      const initial = text.createSnapshot({ text: "First" })
      const root = createDocument(getStore(), object({ child: optional(blockUnion([text])) }), {
        child: initial,
      })
      const render = () =>
        flushSync(() => reactRoot.render(<BlockView value={root.field("child")!} />))
      render()
      expect(host.textContent).toBe(`${initial.id}:First`)
      root.field("child")!.field("text").set("Edited")
      render()
      expect(host.textContent).toBe(`${initial.id}:Edited`)
      const replacement = text.createSnapshot({ text: "Replacement" })
      root.setOptional("child", replacement)
      render()
      expect(host.textContent).toBe(`${replacement.id}:Replacement`)
    } finally {
      flushSync(() => reactRoot.unmount())
      await window.happyDOM.close()
      for (const [key, descriptor] of globals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    }
  })

  test("mounts nested union renderers as components with working hooks", () => {
    const text = block({
      type: "text",
      fields: { text: string() },
      render: function TextView({ value }) {
        const id = useId()
        return <p id={id}>{value.field("text").get()}</p>
      },
    })
    const other = block({
      type: "other",
      fields: { label: string() },
      render: ({ value }) => <strong>{value.field("label").get()}</strong>,
    })
    const lesson = block({
      type: "lesson",
      fields: { exercises: array(blockUnion([text, other])) },
      render: function LessonView({ value }) {
        return (
          <section>
            {value.field("exercises").map((child) => (
              <BlockView key={child.id} value={child} />
            ))}
          </section>
        )
      },
    })
    const initial = lesson.createSnapshot({
      exercises: [
        text.createSnapshot({ text: "First" }),
        other.createSnapshot({ label: "Second" }),
      ],
    })
    const root = createDocument(getStore(), lesson, initial)
    expect(BlockView({ value: root }).key).toBe(root.id)
    expect(renderToStaticMarkup(<BlockView value={root} />)).toMatch(
      /^<section><p id="[^"]+">First<\/p><strong>Second<\/strong><\/section>$/,
    )
    root.field("exercises").remove(0)
    root.field("exercises").insert(0, other.createSnapshot({ label: "Inserted" }))
    // Parent explicitly rerenders; BlockView has no subscriptions yet.
    expect(renderToStaticMarkup(<BlockView value={root} />)).toBe(
      "<section><strong>Inserted</strong><strong>Second</strong></section>",
    )
  })
})
