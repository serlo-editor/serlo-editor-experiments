import { defineBaseKeymap, union } from "prosekit/core"
import { defineDoc } from "prosekit/extensions/doc"
import { defineParagraph } from "prosekit/extensions/paragraph"
import { defineText } from "prosekit/extensions/text"

import { LocalContentStorage, YjsContentStorage } from "./content-storage.ts"
import { richText, type Schema, type SnapshotOf } from "./schema.ts"

const schema = {
  kind: "object",
  fields: {
    published: { kind: "boolean" },
    title: { kind: "string" },
    sections: {
      kind: "array",
      item: {
        kind: "object",
        fields: {
          body: richText(union(defineDoc(), defineParagraph(), defineText(), defineBaseKeymap())),
        },
      },
    },
  },
} as const satisfies Schema

const snapshot: SnapshotOf<typeof schema> = {
  published: false,
  title: "Draft",
  sections: [
    {
      body: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      },
    },
  ],
}

for (const storage of [new LocalContentStorage(), new YjsContentStorage()]) {
  try {
    const content = storage.save(schema, snapshot)
    const title = content.field("title")
    title.set("Published")
    content.field("published").set(true)

    console.log(storage.constructor.name, title.get(), JSON.stringify(content.get(), null, 2))

    content.field("sections").map((section) => {
      const body = section.field("body")
      const editor = body.editor()
      console.log("Rich-text editor:", editor.schema.topNodeType.name, "mounted:", editor.mounted)
      // In a browser: editor.mount(element). Yjs editing requires a mounted view.
      return body.get()
    })
  } finally {
    storage.dispose()
  }
}
