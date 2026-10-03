import assert from "node:assert/strict"
import test from "node:test"

import { describeWithStores } from "../test-utils/test-with-stores.ts"
import { array } from "./array.ts"
import { createDocument } from "./document.ts"
import { object } from "./object.ts"
import { boolean, string } from "./primitives.ts"

describeWithStores("object schemas", (getStore) => {
  test("reads typed fields and snapshots child edits", () => {
    const initial = {
      name: "Ada",
      active: false,
      tags: ["math"],
      profile: { bio: "Hello" },
    }
    const { root } = createDocument(
      getStore(),
      object({
        name: string(),
        active: boolean(),
        tags: array(string()),
        profile: object({ bio: string() }),
      }),
      initial,
    )

    assert.deepEqual(root.snapshot(), initial)
    assert.equal(root.field("name").get() satisfies string, "Ada")
    assert.equal(root.field("active").get() satisfies boolean, false)

    root.field("name").set("Grace")
    root.field("active").set(true)
    root.field("tags").insert(1, "code")
    root.field("profile").field("bio").set("Updated")

    assert.deepEqual(root.snapshot(), {
      name: "Grace",
      active: true,
      tags: ["math", "code"],
      profile: { bio: "Updated" },
    })

    // @ts-expect-error Object handles expose field(), not get().
    assert.equal(root.get, undefined)
    // @ts-expect-error Fields are edited through child handles, not replaced.
    assert.equal(root.set, undefined)
    assert.throws(() => {
      // @ts-expect-error Unknown fields are rejected.
      root.field("missing")
    })
  })

  test("supports empty objects", () => {
    const { root } = createDocument(getStore(), object({}), {})

    assert.deepEqual(root.snapshot(), {})
  })
})
