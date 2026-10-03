import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"

import { cn } from "@/utils/cn"

import type { BlankAttributes } from "./blank-extension"

/** how a blank looks inside the text editor: a chip showing its first answer */
export function BlankView({ node, selected }: NodeViewProps) {
  const { answers } = node.attrs as BlankAttributes
  const [first, ...rest] = answers
  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        "mx-0.5 inline-flex cursor-pointer items-baseline gap-1 rounded-md bg-indigo-50 px-2 text-indigo-900 ring-offset-white",
        !first && "text-indigo-900/50",
        selected && "ring-2 ring-indigo-300 ring-offset-1",
      )}
    >
      {first || "Lücke"}
      {rest.length > 0 && (
        <span className="text-xs font-bold text-indigo-700" title={rest.join(", ")}>
          +{rest.length}
        </span>
      )}
    </NodeViewWrapper>
  )
}
