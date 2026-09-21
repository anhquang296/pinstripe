import type { TOptionalWithFlag, TSchema } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export function Default<T extends TSchema, V>(schema: T, value: V): T {
  return Type.Unsafe<V>({ ...schema, default: value }) as unknown as T;
}

export function Optional<T extends TSchema>(schema: T): TOptionalWithFlag<T, true> {
  if ('default' in schema) {
    throw new Error('Optional() field must not declare a default — use Default() instead');
  }

  return Type.Optional(schema);
}
