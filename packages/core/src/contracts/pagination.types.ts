import type { Static, TSchema } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export const DEFAULT_PAGE_LIMIT = 10;
export const MAX_PAGE_LIMIT = 100;

export const paginationSchema = Type.Object({
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: MAX_PAGE_LIMIT, default: DEFAULT_PAGE_LIMIT }),
  ),
  startingAfter: Type.Optional(Type.String()),
  endingBefore: Type.Optional(Type.String()),
});

export function ListResponseSchema<T extends TSchema>(item: T) {
  return Type.Object({
    object: Type.Literal('list'),
    url: Type.String(),
    hasMore: Type.Boolean(),
    data: Type.Array(item),
  });
}

export interface ListResponse<T> {
  object: 'list';
  url: string;
  hasMore: boolean;
  data: T[];
}

export type PaginationQuery = Static<typeof paginationSchema>;
