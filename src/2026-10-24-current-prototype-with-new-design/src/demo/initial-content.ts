import { ContentType, type JSONValue, type Root } from "../editor"

export const initialContent: JSONValue<Root> = [
  {
    type: ContentType.Text,
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
  },
  {
    type: ContentType.FillInTheBlank,
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
  },
  {
    type: ContentType.MultipleChoice,
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
  },
]
