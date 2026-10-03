import { ListItem } from "@tiptap/extension-list"
import { TableKit } from "@tiptap/extension-table"
import { Placeholder } from "@tiptap/extensions"
import { CellSelection } from "@tiptap/pm/tables"
import {
  EditorContent,
  Extension,
  useEditor,
  useEditorState,
  type ChainedCommands,
  type Editor,
  type Extensions,
} from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  ChevronDown,
  ChevronsDownUp,
  Code,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  PanelLeft,
  PanelTop,
  Shapes,
  Sigma,
  SquareGanttChart,
  Table as TableIcon,
  Trash2,
  Youtube,
} from "lucide-react"
import { forwardRef, useEffect, useLayoutEffect, useState, type ReactNode } from "react"

import { Box, BoxContent, BoxTitle } from "@/components/box"
import { CodeBlock } from "@/components/code-block"
import { Emoji } from "@/components/emoji"
import { Geogebra } from "@/components/geogebra"
import { Image } from "@/components/image"
import { Math, MathBlock } from "@/components/math"
import { Spoiler, SpoilerContent, SpoilerTitle } from "@/components/spoiler"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Video } from "@/components/video"
import { focusAdjacentField, isPlainArrowKey } from "@/utils/arrow-key-navigation"
import { cn } from "@/utils/cn"
import { isEmojiListOpen } from "@/utils/emoji-list"

/**
 * Marks paragraphs that continue the line above with `data-tight`, which drops
 * the spacing before them (see `index.css`). They stay blocks of their own, so
 * block level commands (lists, headings, boxes, …) only ever affect one line.
 */
const TightParagraph = Extension.create({
  name: "tightParagraph",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          tight: {
            default: false,
            parseHTML: (element) => element.hasAttribute("data-tight"),
            renderHTML: ({ tight }) => (tight ? { "data-tight": "" } : {}),
          },
        },
      },
    ]
  },
})

/**
 * Enter starts a tight paragraph, which reads as a line break, Mod-Enter a
 * spaced one. Lists and headings keep their default Enter behavior.
 */
const EnterAsTightParagraph = Extension.create({
  name: "enterAsTightParagraph",
  addKeyboardShortcuts() {
    const split = (tight: boolean) => () =>
      // code blocks bring their own Enter (newline, triple-Enter to exit)
      !this.editor.isActive("codeBlock") &&
      this.editor.commands.first(({ chain, commands, editor }) => [
        () => commands.splitListItem("listItem"),
        // an empty list item leaves the list instead of growing it
        () => commands.liftEmptyBlock(),
        () => editor.isActive("heading") && commands.splitBlock(),
        // the split copies the attributes, so both are set explicitly
        () => chain().splitBlock().updateAttributes("paragraph", { tight }).run(),
      ])

    return {
      Enter: split(true),
      "Shift-Enter": split(true),
      "Mod-Enter": split(false),
    }
  },
})

/**
 * A list item holds text and nested lists, no blocks: a box, a table, an image
 * … inside a bullet reads badly, and ProseMirror puts the ones that do not fit
 * after the list instead.
 */
const TextOnlyListItem = ListItem.extend({
  content: "paragraph (paragraph | bulletList | orderedList)*",
})

/**
 * Minimal Tiptap editor. `value` is HTML, `onChange` receives HTML
 * (or "" when the document is empty).
 */
export const RichTextEditor = forwardRef<
  HTMLDivElement,
  {
    id?: string
    value: string
    onChange: (html: string) => void
    placeholder?: string
    className?: string
    /** additional tiptap extensions, must be a stable reference */
    extensions?: Extensions
    /** hands out the editor instance, e.g. to run commands from outside */
    onCreate?: (editor: Editor) => void
  }
>(function RichTextEditor(
  { id, value, onChange, placeholder, className, extensions = [], onCreate },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        link: {
          openOnClick: false,
          defaultProtocol: "https",
          // `[Text](url)` while typing and on paste
          markdownLinks: true,
        },
        // not exposed via toolbar, keep the schema small
        blockquote: false,
        code: false,
        // replaced by our highlighting code block
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        // replaced by the one that takes no blocks
        listItem: false,
      }),
      TextOnlyListItem,
      Image.configure({ HTMLAttributes: { class: "rounded-lg" } }),
      CodeBlock,
      Emoji,
      Math,
      MathBlock,
      TableKit.configure({ table: { resizable: false } }),
      Spoiler,
      SpoilerTitle,
      SpoilerContent,
      Box,
      BoxTitle,
      BoxContent,
      Video,
      Geogebra,
      Placeholder.configure({
        // every empty node, so the spoiler/box title keeps its hint while unfocused
        showOnlyCurrent: false,
        includeChildren: true,
        placeholder: ({ node }) =>
          node.type.name === "spoilerTitle" || node.type.name === "boxTitle"
            ? "Titel"
            : (placeholder ?? ""),
      }),
      TightParagraph,
      EnterAsTightParagraph,
      ...extensions,
    ],
    content: value,
    editorProps: {
      attributes: {
        id: id ?? "",
        class: "prose prose-lg max-w-none min-h-[5.75rem] px-4 py-3 focus:outline-none",
      },
      // ArrowUp on the first line / ArrowDown on the last line leave the editor
      handleKeyDown(view, event) {
        const direction = isPlainArrowKey(event)
        // the emoji list steers with the arrow keys while it is open
        if (!direction || isEmojiListOpen(view)) return false
        const { $from } = view.state.selection
        const isEdgeLine = view.endOfTextblock(direction === -1 ? "up" : "down")
        if (!isEdgeLine || !isEdgeBlock(view.state.doc, $from, direction)) return false
        return focusAdjacentField(view.dom, direction)
      },
    },
    onCreate: ({ editor }) => onCreate?.(editor),
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : editor.getHTML())
    },
  })

  // sync external changes (e.g. state reset) without clobbering the cursor while typing
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? "" : editor.getHTML()
    if (value !== current) editor.commands.setContent(value)
  }, [editor, value])

  const isFocused = useEditorState({
    editor,
    selector: ({ editor }) => editor?.isFocused ?? false,
  })

  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false)
  // editing a formula moves the focus into its math field, which leaves the
  // ProseMirror editor itself unfocused
  const [isFocusWithin, setIsFocusWithin] = useState(false)

  if (!editor) return null

  return (
    <div
      ref={ref}
      onFocus={() => setIsFocusWithin(true)}
      onBlur={(event) => setIsFocusWithin(event.currentTarget.contains(event.relatedTarget))}
      className={cn(
        "rounded-xl border border-neutral-200 bg-white ring-offset-white focus-within:ring-2 focus-within:ring-neutral-300",
        className,
      )}
    >
      {/* stays visible while the table menu holds focus */}
      <Toolbar editor={editor} isVisible={isFocusWithin || isTableMenuOpen} />
      <div className="relative">
        <EditorContent editor={editor} />
        <TableCellMenu
          editor={editor}
          isEditorFocused={isFocused}
          isOpen={isTableMenuOpen}
          onOpenChange={setIsTableMenuOpen}
        />
      </div>
    </div>
  )
})

function Toolbar({ editor, isVisible }: { editor: Editor; isVisible: boolean }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      link: editor.isActive("link"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      orderedList: editor.isActive("orderedList"),
      bulletList: editor.isActive("bulletList"),
      codeBlock: editor.isActive("codeBlock"),
      math: editor.isActive("math"),
      spoiler: editor.isActive("spoiler"),
      box: editor.isActive("box"),
      table: editor.isActive("table"),
      // blocks cannot be nested in a list, see `TextOnlyListItem`
      isInList: editor.isActive("listItem"),
    }),
  })

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("URL", previous ?? "https://")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  return (
    // always rendered so the box keeps its height, only hidden while unfocused
    <div
      aria-hidden={!isVisible}
      className={cn(
        "flex flex-wrap items-center gap-0.5 border-b border-neutral-200 px-2 py-1.5 transition-opacity",
        !isVisible && "invisible opacity-0",
      )}
    >
      <ToolbarButton
        label="Fett"
        isActive={active.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label="Kursiv"
        isActive={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton label="Link" isActive={active.link} onClick={setLink}>
        <LinkIcon />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Überschrift 1"
        isDisabled={active.isInList}
        isActive={active.h1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 />
      </ToolbarButton>
      <ToolbarButton
        label="Überschrift 2"
        isDisabled={active.isInList}
        isActive={active.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Nummerierte Liste"
        isActive={active.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Aufzählung"
        isActive={active.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Spoiler"
        isDisabled={active.isInList}
        isActive={active.spoiler}
        onClick={() => editor.chain().focus().toggleSpoiler().run()}
      >
        <ChevronsDownUp />
      </ToolbarButton>
      <ToolbarButton
        label="Box"
        isDisabled={active.isInList}
        isActive={active.box}
        onClick={() => editor.chain().focus().toggleBox().run()}
      >
        <SquareGanttChart />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Code-Block"
        isDisabled={active.isInList}
        isActive={active.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code />
      </ToolbarButton>

      <ToolbarButton
        label="Formel"
        isActive={active.math}
        onClick={() => editor.chain().focus().insertMath().run()}
      >
        <Sigma />
      </ToolbarButton>
      <ToolbarButton
        label="Bild"
        isDisabled={active.isInList}
        onClick={() => editor.chain().focus().setImage({ src: "" }).run()}
      >
        <ImageIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Video"
        isDisabled={active.isInList}
        onClick={() => editor.chain().focus().setVideo().run()}
      >
        <Youtube />
      </ToolbarButton>
      <ToolbarButton
        label="GeoGebra"
        isDisabled={active.isInList}
        onClick={() => editor.chain().focus().setGeogebra().run()}
      >
        <Shapes />
      </ToolbarButton>
      <ToolbarButton
        label="Tabelle"
        isDisabled={active.isInList}
        isActive={active.table}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()
        }
      >
        <TableIcon />
      </ToolbarButton>
    </div>
  )
}

/** the table cell containing the selection, with its position in the grid */
function activeTableCell(editor: Editor) {
  const { selection, doc } = editor.state
  let $cell: import("@tiptap/pm/model").ResolvedPos | null = null
  if (selection instanceof CellSelection) {
    $cell = selection.$anchorCell
  } else {
    const { $from } = selection
    for (let depth = $from.depth; depth > 0; depth--) {
      const name = $from.node(depth).type.name
      if (name === "tableCell" || name === "tableHeader") {
        $cell = doc.resolve($from.before(depth))
        break
      }
    }
  }
  if (!$cell) return null
  const table = $cell.node($cell.depth - 1)
  const isHeaderCell = (node: import("@tiptap/pm/model").Node | null) =>
    node?.type.name === "tableHeader"
  let hasHeaderRow = true
  let hasHeaderCol = true
  table.forEach((row, _, index) => {
    if (index === 0) row.forEach((c) => (hasHeaderRow &&= isHeaderCell(c)))
    hasHeaderCol &&= isHeaderCell(row.firstChild)
  })
  return {
    pos: $cell.pos,
    isHeader: isHeaderCell($cell.nodeAfter),
    hasHeaderRow,
    hasHeaderCol,
    isFirstCol: $cell.index() === 0,
    isFirstRow: $cell.index($cell.depth - 1) === 0,
  }
}

/**
 * Round caret button pinned to the top-right corner of the active table cell,
 * opening a menu with row/column actions.
 */
function TableCellMenu({
  editor,
  isEditorFocused,
  isOpen,
  onOpenChange,
}: {
  editor: Editor
  isEditorFocused: boolean
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}) {
  const cell = useEditorState({
    editor,
    selector: ({ editor }) => activeTableCell(editor),
  })
  const [offset, setOffset] = useState<{ top: number; left: number } | null>(null)

  // (re)position after every transaction, cell sizes change while typing
  useLayoutEffect(() => {
    const update = () => {
      const current = activeTableCell(editor)
      const dom = current && (editor.view.nodeDOM(current.pos) as Element | null)
      const container = editor.view.dom.parentElement
      if (!dom || !container) return setOffset(null)
      const cellRect = dom.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setOffset({
        top: cellRect.top - containerRect.top,
        left: cellRect.right - containerRect.left,
      })
    }
    update()
    editor.on("transaction", update)
    return () => {
      editor.off("transaction", update)
    }
  }, [editor])

  if (!cell || !offset || !(isEditorFocused || isOpen)) return null

  const run = (command: (chain: ChainedCommands) => ChainedCommands) =>
    command(editor.chain().focus()).run()

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Tabellenoptionen"
          title="Tabellenoptionen"
          style={{ top: offset.top + 4, left: offset.left - 4 }}
          className="absolute z-10 flex h-5 w-5 -translate-x-full items-center justify-center rounded-full bg-neutral-200/90 text-neutral-600 shadow-sm transition-colors hover:bg-indigo-100 hover:text-indigo-700 data-[state=open]:bg-indigo-100 data-[state=open]:text-indigo-700"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {cell.isFirstRow && (
          <MenuItem
            icon={<PanelTop />}
            label={cell.hasHeaderRow ? "Zeilentitel aus" : "Zeilentitel an"}
            onSelect={() => run((c) => c.toggleHeaderRow())}
          />
        )}
        {cell.isFirstCol && (
          <MenuItem
            icon={<PanelLeft />}
            label={cell.hasHeaderCol ? "Spaltentitel aus" : "Spaltentitel an"}
            onSelect={() => run((c) => c.toggleHeaderColumn())}
          />
        )}
        {(cell.isFirstRow || cell.isFirstCol) && <DropdownMenuSeparator />}
        {cell.isFirstRow && !cell.isHeader && (
          <MenuItem
            icon={<BetweenHorizontalStart />}
            label="Zeile darüber einfügen"
            onSelect={() => run((c) => c.addRowBefore())}
          />
        )}
        {cell.isFirstCol && !cell.isHeader && (
          <MenuItem
            icon={<BetweenVerticalStart />}
            label="Spalte links einfügen"
            onSelect={() => run((c) => c.addColumnBefore())}
          />
        )}
        <MenuItem
          icon={<BetweenHorizontalEnd />}
          label="Zeile darunter einfügen"
          onSelect={() => run((c) => c.addRowAfter())}
        />
        <MenuItem
          icon={<BetweenVerticalEnd />}
          label="Spalte rechts einfügen"
          onSelect={() => run((c) => c.addColumnAfter())}
        />
        <DropdownMenuSeparator />
        <MenuItem
          icon={<Trash2 />}
          label="Zeile löschen"
          onSelect={() => run((c) => c.deleteRow())}
        />
        <MenuItem
          icon={<Trash2 />}
          label="Spalte löschen"
          onSelect={() => run((c) => c.deleteColumn())}
        />
        <MenuItem
          icon={<Trash2 />}
          label="Tabelle löschen"
          onSelect={() => run((c) => c.deleteTable())}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuItem({
  icon,
  label,
  onSelect,
}: {
  icon: ReactNode
  label: string
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className="gap-2 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-neutral-500"
    >
      {icon}
      {label}
    </DropdownMenuItem>
  )
}

function ToolbarButton({
  label,
  isActive = false,
  isDisabled = false,
  onClick,
  children,
}: {
  label: string
  isActive?: boolean
  isDisabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      disabled={isDisabled}
      // keep focus (and selection) inside the editor
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded-md p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent [&>svg]:h-4 [&>svg]:w-4",
        isActive && "bg-indigo-50 text-indigo-700",
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
}

/** true when no other textblock lies before (-1) / after (1) the block at $pos */
function isEdgeBlock(
  doc: import("@tiptap/pm/model").Node,
  $pos: import("@tiptap/pm/model").ResolvedPos,
  direction: -1 | 1,
) {
  const [from, to] =
    direction === -1 ? [0, $pos.before($pos.depth)] : [$pos.after($pos.depth), doc.content.size]
  let found = false
  if (from < to)
    doc.nodesBetween(from, to, (node) => {
      if (node.isTextblock) found = true
      return !found
    })
  return !found
}
