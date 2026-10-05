import { test } from "@playwright/test"

import { clickText, expectCursorInEditor, loadPrototype } from "./utils"

test("Cursor of first editor is visible in second editor", async ({ page }) => {
  await loadPrototype(page)

  await clickText(page, "Editor 1", /This is an example/)

  await expectCursorInEditor(page, "Editor 2")
})

test("Cursor changes when editor focus is changed", async ({ page }) => {
  await loadPrototype(page)

  await clickText(page, "Editor 2", /This is an example/)
  await clickText(page, "Editor 1", /This is an example/)

  await expectCursorInEditor(page, "Editor 2")
})
