import { RichText, StaticRichText } from "@editor/components"
import type { StoredBlock } from "@editor/schema"
import { WorksheetMode, useWorksheet } from "@editor/worksheet"

import type { textFields } from "./index"

export function TextView({ value }: { value: StoredBlock<"text", typeof textFields> }) {
  const { mode } = useWorksheet()
  return mode === WorksheetMode.EditingContent ? (
    <RichText value={value.content} />
  ) : (
    <StaticRichText value={value.content} />
  )
}
