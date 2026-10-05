import { expect, test } from "@playwright/test"

import { loadPrototype } from "./utils"

test("Editor prototype should load", async ({ page }) => {
  await loadPrototype(page)

  await expect(page.getByLabel("Editor 1").getByText(/This is an example/)).toBeVisible()
})
