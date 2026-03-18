export class Source {
  constructor(config: unknown, params?: unknown[], parent?: unknown, options?: unknown);
  static decodeAll(dataByRowId: unknown, field: string, typeInfo: unknown): void;
}

export class ParamInput {
  constructor(...args: unknown[]);
}

export class ComputedView {
  constructor(source: unknown, options?: unknown);
}

export class Prefs {
  constructor(...args: unknown[]);
}

export class PrefsBackend {
  constructor(...args: unknown[]);
}

export class Perspective {
  constructor(...args: unknown[]);
}

export class Aggregate {
  constructor(...args: unknown[]);
}

export class AggregateInfo {
  constructor(...args: unknown[]);
  instance: { calculate(data: unknown[]): unknown };
  name?: string;
  fields?: string[];
}

export const AGGREGATE_REGISTRY: {
  each: (fn: (value: { prototype: Record<string, unknown> }, key: string) => void) => void;
};

export const PREFS_BACKEND_REGISTRY: unknown;

export const jQuery: unknown;

export class OrdMap {
  constructor(...args: unknown[]);
}

export class Lock {
  constructor(...args: unknown[]);
}

export const Util: Record<string, unknown>;
