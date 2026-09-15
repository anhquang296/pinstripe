import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const productSchema = Type.Object({
  object: Type.Literal('product'),
  id: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  active: Type.Boolean(),
  unitLabel: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const productParamsSchema = Type.Object({
  productId: Type.String(),
});

export const createProductSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String()),
    active: Type.Optional(Type.Boolean()),
    unitLabel: Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateProductSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1 })),
    description: Type.Optional(Type.String()),
    active: Type.Optional(Type.Boolean()),
    unitLabel: Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const getProductsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    active: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export type Product = Static<typeof productSchema>;
export type CreateProductPayload = Static<typeof createProductSchema>;
export type UpdateProductPayload = Static<typeof updateProductSchema>;
export type GetProductsQuery = Static<typeof getProductsSchema>;
