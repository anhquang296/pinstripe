import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';

export const customerSchema = Type.Object({
  object: Type.Literal('customer'),
  id: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  description: Type.String(),
  phone: Type.String(),
  taxId: Type.Union([Type.String(), Type.Null()]),
  address: Type.Union([
    Type.Object({
      line1: Type.Optional(Type.String()),
      line2: Type.Optional(Type.String()),
      city: Type.Optional(Type.String()),
      state: Type.Optional(Type.String()),
      postalCode: Type.Optional(Type.String()),
      country: Type.Optional(Type.String()),
    }),
    Type.Null(),
  ]),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  testClockId: Type.Union([Type.String(), Type.Null()]),
  balance: Type.Integer(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const customerParamsSchema = Type.Object({
  customerId: Type.String(),
});

export const createCustomerSchema = Type.Object(
  {
    email: Type.Optional(Type.String({ format: 'email' })),
    name: Type.Optional(Type.String({ minLength: 1 })),
    description: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    taxId: Type.Optional(Type.String()),
    address: Type.Optional(
      Type.Object({
        line1: Type.Optional(Type.String()),
        line2: Type.Optional(Type.String()),
        city: Type.Optional(Type.String()),
        state: Type.Optional(Type.String()),
        postalCode: Type.Optional(Type.String()),
        country: Type.Optional(Type.String()),
      }),
    ),
    currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
    testClockId: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateCustomerSchema = Type.Object(
  {
    email: Type.Optional(Type.String({ format: 'email' })),
    name: Type.Optional(Type.String({ minLength: 1 })),
    description: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    taxId: Type.Optional(Type.String()),
    address: Type.Optional(
      Type.Object({
        line1: Type.Optional(Type.String()),
        line2: Type.Optional(Type.String()),
        city: Type.Optional(Type.String()),
        state: Type.Optional(Type.String()),
        postalCode: Type.Optional(Type.String()),
        country: Type.Optional(Type.String()),
      }),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const getCustomersSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    email: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type Customer = Static<typeof customerSchema>;
export type CreateCustomerPayload = Static<typeof createCustomerSchema>;
export type UpdateCustomerPayload = Static<typeof updateCustomerSchema>;
export type GetCustomersQuery = Static<typeof getCustomersSchema>;
