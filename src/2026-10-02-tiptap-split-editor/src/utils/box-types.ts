import { createLucideIcon } from "lucide-react"

/** the shape of a lucide icon: its svg children with their attributes */
type IconNode = [tag: "path", attrs: Record<string, string>][]

/**
 * Icon shapes copied from lucide (the icon's name is in the comment), so that
 * the same definition can render as a React component in the editor and as
 * plain svg markup in the HTML the previews show.
 */
const ICON_NODES = {
  // Sparkle
  example: [
    [
      "path",
      {
        d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
      },
    ],
  ],
  // Quote
  quote: [
    [
      "path",
      {
        d: "M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
      },
    ],
    [
      "path",
      {
        d: "M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
      },
    ],
  ],
  // Signpost
  approach: [
    ["path", { d: "M12 13v8" }],
    ["path", { d: "M12 3v3" }],
    [
      "path",
      {
        d: "M18 6a2 2 0 0 1 1.414.586l2.293 2.207a1 1 0 0 1 0 1.414l-2.27 2.184a2 2 0 0 1-1.742.586L6 13a2 2 0 0 1-1.414-.586l-2.293-2.207a1 1 0 0 1 0-1.414l2.293-2.207A2 2 0 0 1 6 6z",
      },
    ],
  ],
  // TriangleAlert
  attention: [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
      },
    ],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  // Brain
  remember: [
    [
      "path",
      {
        d: "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",
      },
    ],
    [
      "path",
      {
        d: "M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",
      },
    ],
    ["path", { d: "M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" }],
    ["path", { d: "M17.599 6.5a3 3 0 0 0 .399-1.375" }],
    ["path", { d: "M6.003 5.125A3 3 0 0 0 6.401 6.5" }],
    ["path", { d: "M3.477 10.896a4 4 0 0 1 .585-.396" }],
    ["path", { d: "M19.938 10.5a4 4 0 0 1 .585.396" }],
    ["path", { d: "M6 18a4 4 0 0 1-1.967-.516" }],
    ["path", { d: "M19.967 17.484A4 4 0 0 1 18 18" }],
  ],
  // Pointer
  note: [
    ["path", { d: "M22 14a8 8 0 0 1-8 8" }],
    ["path", { d: "M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" }],
    ["path", { d: "M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" }],
    ["path", { d: "M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" }],
    [
      "path",
      {
        d: "M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
      },
    ],
  ],
  // Pin
  definition: [
    ["path", { d: "M12 17v5" }],
    [
      "path",
      {
        d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
      },
    ],
  ],
  // Lightbulb
  theorem: [
    [
      "path",
      {
        d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
      },
    ],
    ["path", { d: "M9 18h6" }],
    ["path", { d: "M10 22h4" }],
  ],
  // FileCheck
  proof: [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
    ["path", { d: "m9 15 2 2 4-4" }],
  ],
} satisfies Record<string, IconNode>

export type BoxType = "blank" | keyof typeof ICON_NODES

/** the untyped box, which shows no badge at all */
const DEFAULT_BOX_TYPE: BoxType = "blank"

export const BOX_TYPES: { value: BoxType; label: string }[] = [
  { value: "blank", label: "Blanko" },
  { value: "example", label: "Beispiel" },
  { value: "quote", label: "Zitat" },
  { value: "approach", label: "Vorgehen" },
  { value: "attention", label: "Vorsicht" },
  { value: "remember", label: "Merke" },
  { value: "note", label: "Beachte" },
  { value: "definition", label: "Definition" },
  { value: "theorem", label: "Satz" },
  { value: "proof", label: "Beweis" },
]

/** falls back to the blank box for types we do not know (e.g. pasted HTML) */
export function resolveBoxType(value: string | null | undefined): BoxType {
  return BOX_TYPES.some((type) => type.value === value) ? (value as BoxType) : DEFAULT_BOX_TYPE
}

export function boxTypeLabel(type: BoxType) {
  return BOX_TYPES.find(({ value }) => value === type)?.label ?? ""
}

/** lucide keys the svg children as React children, ours go by their index */
function keyed(iconNode: IconNode): IconNode {
  return iconNode.map(([tag, attrs], index): IconNode[number] => [
    tag,
    { ...attrs, key: String(index) },
  ])
}

const ICONS = Object.fromEntries(
  Object.entries(ICON_NODES).map(([type, iconNode]) => [
    type,
    createLucideIcon(type, keyed(iconNode)),
  ]),
) as Record<keyof typeof ICON_NODES, ReturnType<typeof createLucideIcon>>

/** the type's icon as a React component, `null` for the blank box */
export function boxTypeIcon(type: BoxType) {
  return type === "blank" ? null : ICONS[type]
}

const SVG_ATTRIBUTES = [
  'xmlns="http://www.w3.org/2000/svg"',
  'viewBox="0 0 24 24"',
  'fill="none"',
  'stroke="currentColor"',
  'stroke-width="2"',
  'stroke-linecap="round"',
  'stroke-linejoin="round"',
].join(" ")

/** the type's badge as markup, for previews. `null` for the blank box */
export function boxBadgeHTML(type: BoxType) {
  if (type === "blank") return null
  const paths = ICON_NODES[type].map(([tag, { d }]) => `<${tag} d="${d}"/>`).join("")
  return `<span class="box-badge"><svg ${SVG_ATTRIBUTES}>${paths}</svg>${boxTypeLabel(type)}</span>`
}
