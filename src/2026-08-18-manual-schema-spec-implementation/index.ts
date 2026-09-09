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

interface Schema<V extends Value = Value> {
  readonly kind: string;
  readonly __value?: V;
}

type ValueOf<S extends Schema> = S extends Schema<infer Value> ? Value : never;

interface StringSchema extends Schema<StringValue> {
  readonly kind: "string";
}

const string = (): StringSchema => ({ kind: "string" });

interface ArraySchema<C extends Schema> extends Schema<ArrayValue<ValueOf<C>>> {
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

// example usage

export const tags = array(string(), { min: 1, max: 5 });
