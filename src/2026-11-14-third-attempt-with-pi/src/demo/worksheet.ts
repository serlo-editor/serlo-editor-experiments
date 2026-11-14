import { richText as defineRichText } from "@editor/rich-text"
import type { RichTextJSON } from "@editor/rich-text"
import { array, block, boolean, object, record, richText, string } from "@editor/schema"
import type { NodeJSON } from "prosekit/core"

const text = richText({
  definition: defineRichText.block({
    blocks: { paragraph: true, heading: true, bulletList: true, orderedList: true },
    marks: { bold: true, italic: true },
  }),
})
const gapText = richText({
  definition: defineRichText.block({
    blocks: { paragraph: true },
    marks: { bold: true, italic: true, gap: true },
  }),
})
const inline = richText({
  definition: defineRichText.inline({ marks: { bold: true, italic: true } }),
})
const comment = richText({
  definition: defineRichText.block({
    blocks: { paragraph: true, bulletList: true, orderedList: true },
    marks: { bold: true, italic: true },
  }),
})

export const contentSchema = object({
  intro: block({ type: "text", fields: { body: text }, render: () => null }),
  gap: block({ type: "gap", fields: { body: gapText }, render: () => null }),
  choice: block({
    type: "choice",
    fields: {
      question: inline,
      options: array(object({ id: string(), body: inline, correct: boolean() }), {
        defaultLength: 0,
      }),
    },
    render: () => null,
  }),
})
export const answersSchema = object({ gaps: record(string()), choices: record(boolean()) })
export const feedbackSchema = object({
  exercises: record(object({ automatic: string(), override: string(), comment })),
  overall: comment,
})

const paragraph = (value: string): RichTextJSON => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
})
const inlineText = (value: string): RichTextJSON => ({
  type: "doc",
  content: [{ type: "inlineBlock", content: [{ type: "text", text: value }] }],
})

export const initialContent = {
  intro: contentSchema.defaultValue().intro,
  gap: contentSchema.defaultValue().gap,
  choice: contentSchema.defaultValue().choice,
}
initialContent.intro = {
  ...initialContent.intro,
  body: paragraph("This is an example of educational content with various types of items."),
}
initialContent.gap = {
  ...initialContent.gap,
  body: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "The capital of France is " },
          {
            type: "text",
            text: "Paris",
            marks: [{ type: "gap", attrs: { id: "capital-france" } }],
          },
          { type: "text", text: "." },
        ],
      },
    ],
  },
}
initialContent.choice = {
  ...initialContent.choice,
  question: inlineText("What is 2 + 2?"),
  options: [
    { id: "three", body: inlineText("3"), correct: false },
    { id: "four", body: inlineText("4"), correct: true },
    { id: "five", body: inlineText("5"), correct: false },
  ],
}

export const initialAnswers = answersSchema.defaultValue()
export const initialFeedback = feedbackSchema.defaultValue()

export function gaps(doc: RichTextJSON): { id: string; solution: string }[] {
  const found: { id: string; solution: string }[] = []
  function walk(node: NodeJSON) {
    const mark = node.marks?.find((item) => item.type === "gap")
    if (mark && typeof mark.attrs?.id === "string") {
      const previous = found.at(-1)
      if (previous?.id === mark.attrs.id) previous.solution += node.text ?? ""
      else found.push({ id: mark.attrs.id, solution: node.text ?? "" })
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return found
}

export function grade(content: typeof initialContent, answers: typeof initialAnswers) {
  const solutions = gaps(content.gap.body)
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de")
  return {
    [content.gap.id]:
      solutions.length === 0
        ? "unrated"
        : solutions.every(
              ({ id, solution }) =>
                answers.gaps[id]?.trim() && normalize(answers.gaps[id]) === normalize(solution),
            )
          ? "correct"
          : "incorrect",
    [content.choice.id]:
      content.choice.options.length === 0
        ? "unrated"
        : content.choice.options.every(
              (option) => (answers.choices[option.id] ?? false) === option.correct,
            )
          ? "correct"
          : "incorrect",
  }
}
