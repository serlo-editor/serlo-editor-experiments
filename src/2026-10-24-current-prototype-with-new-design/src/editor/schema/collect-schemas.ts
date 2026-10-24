import * as S from "./index"

export function collectSchemas(schema: S.Schema): S.Schema[] {
  const collected = new Set<S.Schema>()
  const toProcess: S.Schema[] = [schema]

  while (true) {
    const current = toProcess.pop()

    if (current == null) {
      break
    }

    if (collected.has(current)) {
      continue
    } else {
      collected.add(current)
    }

    if (S.isLeaf(current)) {
    } else if (S.isWrapper(current)) {
      toProcess.push(current.wrappedSchema)
    } else if (S.isUnion(current)) {
      for (const optionSchema of current.options) {
        toProcess.push(optionSchema)
      }
    } else if (S.isArray(current)) {
      toProcess.push(current.itemSchema)
    } else if (S.isObject(current)) {
      for (const propertySchema of Object.values(current.properties)) {
        toProcess.push(propertySchema)
      }
    }
  }

  return [...collected]
}
