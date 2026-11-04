import { FillInTheBlank, MultipleChoice, TextContent, type RootSnapshot } from "../editor/content"

export const initialContent: RootSnapshot = [
  TextContent.createSnapshot({
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
  FillInTheBlank.createSnapshot({
    content: {
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
  }),
  MultipleChoice.createSnapshot({
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
        optionId: "three",
        isCorrect: false,
        text: {
          type: "doc",
          content: [{ type: "inlineBlock", content: [{ type: "text", text: "3" }] }],
        },
      },
      {
        optionId: "four",
        isCorrect: true,
        text: {
          type: "doc",
          content: [{ type: "inlineBlock", content: [{ type: "text", text: "4" }] }],
        },
      },
      {
        optionId: "five",
        isCorrect: false,
        text: {
          type: "doc",
          content: [{ type: "inlineBlock", content: [{ type: "text", text: "5" }] }],
        },
      },
    ],
  }),
]
