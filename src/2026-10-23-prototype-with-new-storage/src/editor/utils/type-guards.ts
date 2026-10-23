export type TypeGuard<T> = (value: unknown) => value is T

export type GuardedType<TGuard extends TypeGuard<unknown>> =
  TGuard extends TypeGuard<infer T> ? T : never

export const isNull: TypeGuard<null> = (value) => value === null

export const isString: TypeGuard<string> = (value) => typeof value === "string"

export const isBoolean: TypeGuard<boolean> = (value) => typeof value === "boolean"

export function literal<T extends string | number | boolean>(expected: T): TypeGuard<T> {
  return (value: unknown): value is T => value === expected
}

export function instanceOf<T>(ctor: new (...args: never[]) => T): TypeGuard<T> {
  return (value: unknown): value is T => value instanceof ctor
}

export function union<const Guards extends readonly [TypeGuard<unknown>, ...TypeGuard<unknown>[]]>(
  ...guards: Guards
): TypeGuard<GuardedType<Guards[number]>> {
  return (value: unknown): value is GuardedType<Guards[number]> =>
    guards.some((guard) => guard(value))
}

export function arrayOf<T>(elementGuard: TypeGuard<T>): TypeGuard<T[]> {
  return (value: unknown): value is T[] =>
    Array.isArray(value) && value.every((item) => elementGuard(item))
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function shape<const Spec extends Record<string, TypeGuard<unknown>>>(
  spec: Spec,
): TypeGuard<{ [K in keyof Spec]: GuardedType<Spec[K]> }> {
  return (value: unknown): value is { [K in keyof Spec]: GuardedType<Spec[K]> } => {
    return (
      isObjectLike(value) &&
      Object.entries(spec).every(([key, propertyGuard]) => propertyGuard(value[key]))
    )
  }
}
