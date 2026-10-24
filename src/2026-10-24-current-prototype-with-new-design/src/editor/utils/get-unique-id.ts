const ids = new WeakMap()
let nextId = 0

export function getUniqueId(obj: object): number {
  const existingId = ids.get(obj)

  if (existingId !== undefined) {
    return existingId
  } else {
    const id = nextId++
    ids.set(obj, id)
    return id
  }
}
