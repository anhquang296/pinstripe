import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum TaxTypeEnum {
  VAT = 'vat',
  GST = 'gst',
  SALES_TAX = 'sales_tax',
  CUSTOMS = 'customs',
  OTHER = 'other',
}
export type TaxType = `${TaxTypeEnum}`;

export enum TaxExemptEnum {
  NONE = 'none',
  EXEMPT = 'exempt',
  REVERSE = 'reverse',
}
export type TaxExempt = `${TaxExemptEnum}`;

export enum TaxIdTypeEnum {
  VN_TIN = 'vn_tin',
  EU_VAT = 'eu_vat',
  US_EIN = 'us_ein',
  OTHER = 'other',
}
export type TaxIdType = `${TaxIdTypeEnum}`;

export enum TaxIdVerificationStatusEnum {
  PENDING = 'pending',
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
  UNAVAILABLE = 'unavailable',
}
export type TaxIdVerificationStatus = `${TaxIdVerificationStatusEnum}`;

export enum AutomaticTaxStatusEnum {
  NOT_COLLECTING = 'not_collecting',
  REQUIRES_LOCATION_INPUTS = 'requires_location_inputs',
  COMPLETE = 'complete',
  FAILED = 'failed',
}
export type AutomaticTaxStatus = `${AutomaticTaxStatusEnum}`;

export enum AuthorityStatusEnum {
  NOT_SUBMITTED = 'not_submitted',
  PENDING = 'pending',
  ISSUED = 'issued',
  REJECTED = 'rejected',
}
export type AuthorityStatus = `${AuthorityStatusEnum}`;

export const taxRateSchema = Type.Object({
  object: Type.Literal('tax_rate'),
  id: Type.String(),
  livemode: Type.Boolean(),
  displayName: Type.String(),
  description: Type.String(),
  percentage: Type.Number(),
  inclusive: Type.Boolean(),
  jurisdiction: Type.String(),
  country: Type.Union([Type.String(), Type.Null()]),
  state: Type.Union([Type.String(), Type.Null()]),
  taxType: Type.Unsafe<TaxType>(Type.Enum(TaxTypeEnum)),
  active: Type.Boolean(),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const taxIdSchema = Type.Object({
  object: Type.Literal('tax_id'),
  id: Type.String(),
  livemode: Type.Boolean(),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  type: Type.Unsafe<TaxIdType>(Type.Enum(TaxIdTypeEnum)),
  value: Type.String(),
  country: Type.Union([Type.String(), Type.Null()]),
  verification: Type.Object({
    status: Type.Unsafe<TaxIdVerificationStatus>(Type.Enum(TaxIdVerificationStatusEnum)),
    verifiedName: Type.Union([Type.String(), Type.Null()]),
    verifiedAddress: Type.Union([Type.String(), Type.Null()]),
    attemptedAt: Type.Union([Type.String(), Type.Null()]),
  }),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const deletedTaxIdSchema = Type.Object({
  object: Type.Literal('tax_id'),
  id: Type.String(),
  deleted: Type.Literal(true),
});

export const taxRateParamsSchema = Type.Object({
  taxRateId: Type.String(),
});

export const taxIdParamsSchema = Type.Object({
  taxIdId: Type.String(),
});

export const createTaxRateSchema = Type.Object(
  {
    displayName: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String()),
    percentage: Type.Number({ minimum: 0, maximum: 100 }),
    inclusive: Type.Boolean(),
    jurisdiction: Type.Optional(Type.String()),
    country: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
    state: Type.Optional(Type.String({ minLength: 1 })),
    taxType: Type.Unsafe<TaxType>(Type.Enum(TaxTypeEnum)),
    active: Type.Optional(Type.Boolean()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateTaxRateSchema = Type.Object(
  {
    displayName: Type.Optional(Type.String({ minLength: 1 })),
    description: Type.Optional(Type.String()),
    jurisdiction: Type.Optional(Type.String()),
    active: Type.Optional(Type.Boolean()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findTaxRatesSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    active: Type.Optional(Type.Boolean()),
    inclusive: Type.Optional(Type.Boolean()),
    country: Type.Optional(Type.String()),
    taxType: Type.Optional(Type.Unsafe<TaxType>(Type.Enum(TaxTypeEnum))),
  },
  { additionalProperties: false },
);

export const createTaxIdSchema = Type.Object(
  {
    customerId: Type.String({ minLength: 1 }),
    type: Type.Unsafe<TaxIdType>(Type.Enum(TaxIdTypeEnum)),
    value: Type.String({ minLength: 1, maxLength: 64 }),
    country: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findTaxIdsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type TaxRateResponse = Static<typeof taxRateSchema>;
export type TaxIdResponse = Static<typeof taxIdSchema>;
export type DeletedTaxIdResponse = Static<typeof deletedTaxIdSchema>;
export type CreateTaxRatePayload = Static<typeof createTaxRateSchema>;
export type UpdateTaxRatePayload = Static<typeof updateTaxRateSchema>;
export type FindTaxRatesQuery = Static<typeof findTaxRatesSchema>;
export type CreateTaxIdPayload = Static<typeof createTaxIdSchema>;
export type FindTaxIdsQuery = Static<typeof findTaxIdsSchema>;
