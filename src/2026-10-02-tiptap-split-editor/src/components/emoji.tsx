import TiptapEmoji, { type EmojiItem } from "@tiptap/extension-emoji"
import type { EditorView } from "@tiptap/pm/view"
import { ReactRenderer } from "@tiptap/react"
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion"
import compactEmojis from "emojibase-data/de/compact.json"
import deShortcodes from "emojibase-data/de/shortcodes/cldr.json"
import enShortcodes from "emojibase-data/en/shortcodes/emojibase.json"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { cn } from "@/utils/cn"
import { setEmojiListOpen } from "@/utils/emoji-list"

type Shortcodes = Record<string, string | string[] | undefined>

/** lowercases and drops the umlauts, so "kuche" also finds "Küche" */
function fold(text: string) {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/** shortcodes come as a single string or a list, depending on the emoji */
function toList(shortcodes: Shortcodes, hexcode: string) {
  const shortcode = shortcodes[hexcode]
  return shortcode === undefined ? [] : [shortcode].flat()
}

/**
 * German emoji dataset for the `:kuchen:` typeahead.
 *
 * The node stores its first shortcode as `data-name`, so that one has to stay
 * stable across languages (documents written here must keep rendering if the
 * editor ever switches locale) — hence the English shortcode first, the German
 * ones only as additional search keys. Group 2 (skin tones, hair colors) and
 * the ungrouped regional indicators are dropped, they are building blocks
 * rather than emojis one would pick from a list.
 */
const EMOJIS: EmojiItem[] = (() => {
  const claimed = new Set<string>()

  return compactEmojis
    .filter((emoji) => emoji.group !== undefined && emoji.group !== 2)
    .flatMap((emoji): EmojiItem[] => {
      // a few shortcodes are shared by two emojis ("frowning_face"), first one
      // wins so a stored shortcode always resolves back to the same emoji
      const shortcodes = [
        ...new Set([
          ...toList(enShortcodes, emoji.hexcode),
          ...toList(deShortcodes, emoji.hexcode),
        ]),
      ].filter((shortcode) => !claimed.has(shortcode))
      shortcodes.forEach((shortcode) => claimed.add(shortcode))

      if (shortcodes.length === 0) return []

      return [
        {
          name: shortcodes[0],
          emoji: emoji.unicode,
          shortcodes,
          tags: [emoji.label.toLowerCase(), ...(emoji.tags ?? [])],
          group: String(emoji.group),
          // shown in the suggestion list, `tags` is only searched
          label: emoji.label,
        },
      ]
    })
})()

const MAX_RESULTS = 12

/** folded search keys per emoji, in the order they are matched against */
const INDEX = EMOJIS.map((item) => ({
  item,
  shortcodes: item.shortcodes.map(fold),
  label: fold(item.label as string),
  tags: item.tags.map(fold),
}))

/**
 * Ranks exact shortcodes over prefixes over substrings, and prefers short
 * labels within a rank — otherwise "kuch" leads with "Kuchengabel" instead
 * of the plain "Kuchen".
 */
function search(query: string) {
  const needle = fold(query)
  const matches: { item: EmojiItem; score: number; length: number }[] = []

  for (const entry of INDEX) {
    const score = entry.shortcodes.includes(needle)
      ? 0
      : entry.label === needle
        ? 1
        : entry.shortcodes.some((shortcode) => shortcode.startsWith(needle))
          ? 2
          : entry.label.startsWith(needle)
            ? 3
            : entry.tags.some((tag) => tag.startsWith(needle))
              ? 4
              : entry.shortcodes.some((shortcode) => shortcode.includes(needle))
                ? 5
                : entry.label.includes(needle)
                  ? 6
                  : -1
    if (score >= 0) matches.push({ item: entry.item, score, length: entry.label.length })
  }

  return matches
    .sort((a, b) => a.score - b.score || a.length - b.length)
    .slice(0, MAX_RESULTS)
    .map(({ item }) => item)
}

type EmojiListHandle = { onKeyDown: (props: SuggestionKeyDownProps) => boolean }

const EmojiList = forwardRef<EmojiListHandle, SuggestionProps<EmojiItem>>(function EmojiList(
  { items, command, clientRect },
  ref,
) {
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const [caret, setCaret] = useState<DOMRect | null>(null)

  useEffect(() => setSelected(0), [items])

  // `clientRect` is a fresh closure on every keystroke, so this follows the
  // caret while typing; scrolling moves it without the suggestion updating
  useEffect(() => {
    const update = () => setCaret(clientRect?.() ?? null)
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [clientRect])

  // keep the highlighted entry in view while arrowing through the list
  useEffect(() => {
    listRef.current?.children[selected]?.scrollIntoView({ block: "nearest" })
  }, [selected])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false
      if (event.key === "ArrowUp") {
        setSelected((current) => (current + items.length - 1) % items.length)
        return true
      }
      if (event.key === "ArrowDown") {
        setSelected((current) => (current + 1) % items.length)
        return true
      }
      if (event.key === "Enter" || event.key === "Tab") {
        command(items[selected])
        return true
      }
      return false
    },
  }))

  if (items.length === 0 || !caret) return null

  return createPortal(
    <div
      // `fixed`, because `clientRect` is in viewport coordinates
      style={{ top: caret.bottom + 6, left: caret.left }}
      className="fixed z-50 max-h-64 w-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg"
    >
      <div ref={listRef}>
        {items.map((item, index) => (
          <button
            key={item.name}
            type="button"
            // keep focus (and selection) inside the editor
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command(item)}
            onMouseEnter={() => setSelected(index)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-neutral-600",
              index === selected && "bg-indigo-50 text-indigo-700",
            )}
          >
            <span className="text-base leading-none">{item.emoji}</span>
            <span className="truncate">{item.label}</span>
            <span className="ml-auto shrink-0 text-xs text-neutral-400">:{item.name}:</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
})

/** `:kuchen:` emoji typeahead, searchable in German and English */
export const Emoji = TiptapEmoji.extend({
  // plugins run in reverse extension order, so the suggestion list only gets
  // Enter and the arrow keys before the editor's own shortcuts do when it
  // outranks them
  priority: 101,
}).configure({
  emojis: EMOJIS,
  suggestion: {
    // a lone ":" would pop up on every "Beispiel:" line
    items: ({ query }) => (query.length < 2 ? [] : search(query)),
    render: () => {
      let renderer: ReactRenderer<EmojiListHandle, SuggestionProps<EmojiItem>>
      let view: EditorView
      // Escape closes the list until the current ":..." is done
      let isDismissed = false

      const update = (props: SuggestionProps<EmojiItem>) => {
        const isOpen = !isDismissed && props.items.length > 0
        setEmojiListOpen(props.editor.view, isOpen)
        renderer.updateProps(isOpen ? props : { ...props, items: [] })
      }

      return {
        onStart: (props) => {
          // `render` runs once per editor, every ":" starts over
          isDismissed = false
          view = props.editor.view
          renderer = new ReactRenderer(EmojiList, {
            props: { ...props, items: [] },
            editor: props.editor,
          })
          update(props)
        },
        onUpdate: update,
        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            isDismissed = true
            setEmojiListOpen(view, false)
            renderer.updateProps({ items: [] })
            return true
          }
          return renderer.ref?.onKeyDown(props) ?? false
        },
        onExit: () => {
          setEmojiListOpen(view, false)
          renderer.destroy()
        },
      }
    },
  },
})
