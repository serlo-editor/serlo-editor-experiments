import { FillInTheBlank, MultipleChoice, TextContent, type RootSnapshot } from "../editor/content"

export const initialContent: RootSnapshot = [
  TextContent.createUnit({
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This is an example of educational content with various types of items.",
            },
          ],
        },
      ],
    },
  }),
  FillInTheBlank.createUnit({
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The capital of France is " },
            { type: "text", text: "Paris", marks: [{ type: "gap" }] },
            { type: "text", text: "." },
          ],
        },
      ],
    },
  }),
  MultipleChoice.createUnit({
    question: {
      type: "doc",
      content: [
        {
          type: "inlineBlock",
          content: [{ type: "text", text: "What is 2 + 2?" }],
        },
      ],
    },
    options: [
      {
        isCorrect: false,
        text: {
          type: "doc",
          content: [{ type: "inlineBlock", content: [{ type: "text", text: "3" }] }],
        },
      },
      {
        isCorrect: true,
        text: {
          type: "doc",
          content: [{ type: "inlineBlock", content: [{ type: "text", text: "4" }] }],
        },
      },
      {
        isCorrect: false,
        text: {
          type: "doc",
          content: [{ type: "inlineBlock", content: [{ type: "text", text: "5" }] }],
        },
      },
    ],
  }),
]
