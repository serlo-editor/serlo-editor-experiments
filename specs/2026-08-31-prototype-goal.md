# Serlo Editor — Main Goal

Build embeddable educational editor for creating and editing structured learning content inside LMS applications.

## Initial Prototype Scope

Prototype focuses on authoring these content types:

* Multiple-choice exercise
* Fill-in-the-gap exercise
* Free-form exercise
* Text

Other educational elements will be added later.

## Core Problem

Generic block and rich-text editors model documents mainly as text plus homogeneous child lists.

Educational content requires stronger semantic structures and invariants.

Example:

```ts
type Exercise = {
  question: QuestionNode
  answer: AnswerNode
}
```

Editor must eventually support exact tuples, named child slots, arrays, optional children, unions, wrappers, and domain-specific constraints—not only arbitrary lists of blocks.

## Prototype Goals

* Provide WYSIWYG authoring for some example types: multiple-choice, fill-in-the-gap and rich-text.
* Save / Load complete document as JSON.
* Establish architecture that can later support more element types, learning modes, collaboration, validation, AI features, and transformations.
