// Value types

interface Value {
  readonly type: string;
}

interface StringValue extends Value {
  readonly type: "string";
  get(): string;
  set(value: string): void;
}

interface ArrayValue<C extends Value> {
  readonly type: "array";
  map<R>(mapper: (child: C) => R): R;
}

// schema.ts

interface Schema<V extends Value = Value, JSONValue = unknown> {
  readonly kind: string;
  readonly __value?: V;
  readonly __jsonValue?: JSONValue;
}

type ValueOf<S extends Schema> =
  S extends Schema<infer Value, unknown> ? Value : never;
type JSONValueOf<S extends Schema> =
  S extends Schema<Value, infer JSONValue> ? JSONValue : never;

interface StringSchema extends Schema<StringValue, string> {
  readonly kind: "string";
}

const string = (): StringSchema => ({ kind: "string" });

interface ArraySchema<C extends Schema> extends Schema<
  ArrayValue<ValueOf<C>>,
  JSONValueOf<C>[]
> {
  readonly kind: "array";
  readonly min?: number;
  readonly max?: number;
  readonly element: C;
}

const array = <C extends Schema>(
  element: C,
  options?: { max?: number; min?: number },
): ArraySchema<C> => ({
  kind: "array",
  element,
  ...options,
});

// Storage

type Branded<T, S> = T & { __branded: S };
type Reference = Branded<string, "Reference">;

interface StorageAdapter<R extends Reference> {
  get(reference: R): string;
  set(reference: R, value: string): void;
  getChildren(reference: R): R[];
}

interface Storage {
  save<S extends Schema>(schema: S, value: JSONValueOf<S>): Reference;
  load<S extends Schema>(schema: S, reference: Reference): JSONValueOf<S>;
}

// example usage

export const tags = array(string(), { min: 1, max: 5 });
