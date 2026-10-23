import { expect, test } from "bun:test"

import { Window } from "happy-dom"
import { useId, useState } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

import { createDocument } from "../schema/document.ts"
import { array, childUnit, createUnit, object, string, unit } from "../schema/index.ts"
import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { UnitView } from "./index.ts"

describeWithStores("UnitView", (getStore) => {
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
      const text = unit({
        type: "text",
        fields: { text: string() },
        render: function TextView({ handle }) {
          const [mountedId] = useState(handle.id)
          return (
            <p>
              {mountedId}:{handle.field("text").get()}
            </p>
          )
        },
      })
      const initial = createUnit(text, { text: "First" })
      const { root } = createDocument(getStore(), object({ child: childUnit([text]) }), {
        child: initial,
      })
      const render = () =>
        flushSync(() => reactRoot.render(<UnitView handle={root.field("child")} />))
      render()
      expect(host.textContent).toBe(`${initial.id}:First`)
      root.field("child").field("text").set("Edited")
      render()
      expect(host.textContent).toBe(`${initial.id}:Edited`)
      const replacement = createUnit(text, { text: "Replacement" })
      root.set("child", replacement)
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
    const text = unit({
      type: "text",
      fields: { text: string() },
      render: function TextView({ handle }) {
        const id = useId()
        return <p id={id}>{handle.field("text").get()}</p>
      },
    })
    const other = unit({
      type: "other",
      fields: { label: string() },
      render: ({ handle }) => <strong>{handle.field("label").get()}</strong>,
    })
    const lesson = unit({
      type: "lesson",
      fields: { exercises: array(childUnit([text, other])) },
      render: function LessonView({ handle }) {
        return (
          <section>
            {handle.field("exercises").map((child) => (
              <UnitView key={child.id} handle={child} />
            ))}
          </section>
        )
      },
    })
    const initial = createUnit(lesson, {
      exercises: [createUnit(text, { text: "First" }), createUnit(other, { label: "Second" })],
    })
    const { root } = createDocument(getStore(), lesson, initial)
    expect(UnitView({ handle: root }).key).toBe(root.id)
    expect(renderToStaticMarkup(<UnitView handle={root} />)).toMatch(
      /^<section><p id="[^"]+">First<\/p><strong>Second<\/strong><\/section>$/,
    )
    root.field("exercises").replace(0, createUnit(other, { label: "Replaced" }))
    // Parent explicitly rerenders; UnitView has no subscriptions yet.
    expect(renderToStaticMarkup(<UnitView handle={root} />)).toBe(
      "<section><strong>Replaced</strong><strong>Second</strong></section>",
    )
  })
})
