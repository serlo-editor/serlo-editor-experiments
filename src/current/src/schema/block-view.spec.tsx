import { expect, test } from "bun:test"

import { Window } from "happy-dom"
import { useId, useState } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { array, string, block, BlockView } from "./index.ts"
import { openRoot } from "./root.ts"

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
              {mountedId}:{value.text.get()}
            </p>
          )
        },
      })
      const initial = text.createSnapshot({ text: "First" })
      const root = openRoot(getStore(), array(text), [initial])
      const render = () =>
        flushSync(() => reactRoot.render(<BlockView value={root.children()[0]!} />))
      render()
      expect(host.textContent).toBe(`${initial.id}:First`)
      root.children()[0]!.text.set("Edited")
      render()
      expect(host.textContent).toBe(`${initial.id}:Edited`)
      const replacement = text.createSnapshot({ text: "Replacement" })
      root.remove(0)
      root.insert(0, replacement)
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

  test("renders block component with hooks and current stored content", () => {
    const text = block({
      type: "text",
      fields: { text: string() },
      render: function TextView({ value }) {
        const id = useId()
        return <p id={id}>{value.text.get()}</p>
      },
    })
    const root = openRoot(getStore(), text, text.createSnapshot({ text: "First" }))
    expect(BlockView({ value: root }).key).toBe(root.id)
    expect(renderToStaticMarkup(<BlockView value={root} />)).toMatch(/^<p id="[^"]+">First<\/p>$/)
    root.text.set("Updated")
    // Parent explicitly rerenders; BlockView has no subscriptions yet.
    expect(renderToStaticMarkup(<BlockView value={root} />)).toMatch(/^<p id="[^"]+">Updated<\/p>$/)
  })
})
