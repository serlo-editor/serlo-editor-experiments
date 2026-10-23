export function createProxyWithChangedMethods<A extends object>(
  target: A,
  methods: Record<string, unknown>,
): A {
  return new Proxy(target, {
    get(target, prop, receiver) {
      return typeof prop === "string" && prop in methods
        ? methods[prop]
        : Reflect.get(target, prop, receiver)
    },
  })
}
