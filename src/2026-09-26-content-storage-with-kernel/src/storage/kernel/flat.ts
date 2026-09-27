type MapsByType<ValueByType extends object> = {
  [Type in keyof ValueByType]: Map<string, ValueByType[Type]>
}

export class ValuesByType<ValueByType extends object> {
  private readonly maps: Partial<MapsByType<ValueByType>> = {}

  set<Type extends keyof ValueByType>(type: Type, id: string, value: ValueByType[Type]): void {
    this.getMap(type).set(id, value)
  }

  get<Type extends keyof ValueByType>(type: Type, id: string): ValueByType[Type] | undefined {
    return this.getMap(type).get(id)
  }

  has<Type extends keyof ValueByType>(type: Type, id: string): boolean {
    return this.getMap(type).has(id)
  }

  private getMap<Type extends keyof ValueByType>(type: Type): Map<string, ValueByType[Type]> {
    const map = this.maps[type]

    if (map) return map

    const newMap = new Map<string, ValueByType[Type]>()
    this.maps[type] = newMap

    return newMap
  }
}
