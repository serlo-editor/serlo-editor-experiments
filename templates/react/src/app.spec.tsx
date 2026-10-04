import { expect, test } from "bun:test"

import App from "./app"

test("renders greeting", () => {
  expect(App()).toMatchObject({
    type: "p",
    props: { children: "Hello World" },
  })
})
