import { ValuesByType } from "./buckets.ts"

interface NodeValueByType {
  string: string
  number: number
  boolean: boolean
  array: NodeReference[]
  object: Record<string, NodeReference | undefined>
}

type NodeType = keyof NodeValueByType
type NodeValue<Type extends NodeType> = NodeValueByType[Type]

interface NodeReference<Type extends NodeType = NodeType> {
  type: Type
  id: string
}

export class FlatNodeStore {
  private readonly values = new ValuesByType<NodeValueByType>()

  create<Type extends NodeType>(type: Type, value: NodeValue<Type>): NodeReference<Type> {
    const reference = { type, id: this.createId(type) }

    this.values.set(reference.type, reference.id, value)

    return reference
  }

  get<Type extends NodeType>(reference: NodeReference<Type>): NodeValue<Type> {
    const value = this.values.get(reference.type, reference.id)

    if (value === undefined) {
      throw new Error(`Cannot find node: ${reference.id}`)
    }

    return value
  }

  update<Type extends NodeType>(
    reference: NodeReference<Type>,
    value: NodeValue<Type> | ((currentValue: NodeValue<Type>) => NodeValue<Type>),
  ): void {
    const nextValue = typeof value === "function" ? value(this.get(reference)) : value

    this.values.set(reference.type, reference.id, nextValue)
  }

  private createId<Type extends NodeType>(type: Type): string {
    let id: string

    do {
      id = `${type}-${Math.random().toString(36).slice(2)}`
    } while (this.values.has(type, id))

    return id
  }
}
