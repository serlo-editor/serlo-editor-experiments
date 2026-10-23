import * as F from "../nodes/flat"
import { RichTextFeature } from "../rich-text/types"
import * as S from "../schema"
import { ContentType } from "./types"

const BooleanSchema = S.createBoolean({ name: "Boolean" })

const InlineRichText = S.createRichText({
  name: "InlineRichText",
  features: [RichTextFeature.Bold, RichTextFeature.Italic],
})

const ContentRichText = S.createRichText({
  name: "ContentRichText",
  features: [
    RichTextFeature.Bold,
    RichTextFeature.Italic,
    RichTextFeature.Paragraph,
    RichTextFeature.Heading,
    RichTextFeature.List,
  ],
})

const FillInTheBlankRichText = S.createRichText({
  name: "FillInTheBlankRichText",
  features: [
    RichTextFeature.Bold,
    RichTextFeature.Italic,
    RichTextFeature.Paragraph,
    RichTextFeature.Blank,
  ],
})

const TextContent = S.createWrapper({
  name: "TextContent",
  wrappedSchema: ContentRichText,
  wrap: (value) => ({ type: ContentType.Text, content: value }),
  unwrap: (value) => value.content,
})

const FillInTheBlankExercise = S.createWrapper({
  name: "FillInTheBlankExercise",
  wrappedSchema: FillInTheBlankRichText,
  wrap: (value) => ({ type: ContentType.FillInTheBlank, content: value }),
  unwrap: (value) => value.content,
  customBehavior: {
    render: ({ node, store, renderChild }) => {
      const content = F.getSingletonChild({ node, store })
      return (
        <div key={node.key} className="exercise exercise--fill-blank">
          <p>
            <strong>Fill in the Blank Exercise: </strong>
          </p>
          {renderChild(content)}
        </div>
      )
    },
  },
})

const MultipleChoiceExercise = S.createObject({
  name: "MultipleChoiceExercise",
  properties: {
    type: S.createLiteral({
      name: "MultipleChoiceType",
      value: ContentType.MultipleChoice,
    }),
    question: InlineRichText,
    options: S.createArray({
      name: "MultipleChoiceOptions",
      itemSchema: S.createObject({
        name: "MultipleChoiceOption",
        properties: {
          isCorrect: BooleanSchema,
          text: InlineRichText,
        },
        keyOrder: ["isCorrect", "text"],
        htmlTag: "li",
      }),
      htmlTag: "ul",
      className: "multiple-choice-options",
    }),
  },
  keyOrder: ["question", "options"],
  customBehavior: {
    render: ({ node, store, renderChild }) => {
      const question = F.getProperty({ node, store, propertyName: "question" })
      const options = F.getProperty({ node, store, propertyName: "options" })

      return (
        <div key={node.key} className="exercise exercise--multiple-choice">
          <p>
            <strong>Multiple Choice Exercise: </strong> {renderChild(question)}
          </p>
          {renderChild(options)}
        </div>
      )
    },
  },
})

const EducationalContent = S.createArray({
  name: "EducationalContent",
  itemSchema: S.createUnion({
    name: "EducationalContentItem",
    options: [TextContent, FillInTheBlankExercise, MultipleChoiceExercise],
    getOption: (value) => {
      switch (value.type) {
        case ContentType.Text:
          return TextContent
        case ContentType.FillInTheBlank:
          return FillInTheBlankExercise
        case ContentType.MultipleChoice:
          return MultipleChoiceExercise
      }
    },
  }),
  className: "editor-content",
})

export type Root = typeof Root
export const Root = S.createWrapper({
  name: "Root",
  wrappedSchema: EducationalContent,
  wrap: (value) => value,
  unwrap: (value) => value,
})
