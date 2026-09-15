import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';
import type { LineItemType } from '@utils/rating';
import { LineItemTypeEnum } from '@utils/rating';

export const ratedInvoiceSchema = Type.Object({
  object: Type.Literal('rated_invoice'),
  subscriptionId: Type.String(),
  customerId: Type.String(),
  currency: Type.Unsafe<Currency>(Type.Enum(CurrencyEnum)),
  periodStart: Type.String(),
  periodEnd: Type.String(),
  total: Type.Integer(),
  lineItems: Type.Array(
    Type.Object({
      object: Type.Literal('rated_line_item'),
      subscriptionItemId: Type.String(),
      priceId: Type.String(),
      type: Type.Unsafe<LineItemType>(Type.Enum(LineItemTypeEnum)),
      quantity: Type.Number(),
      ratedQuantity: Type.Number(),
      amount: Type.Integer(),
      periodStart: Type.String(),
      periodEnd: Type.String(),
      prorationFactor: Type.Number(),
    }),
  ),
});

export const getUpcomingInvoiceSchema = Type.Object(
  { subscriptionId: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);

export type RatedInvoiceResponse = Static<typeof ratedInvoiceSchema>;
export type GetUpcomingInvoiceQuery = Static<typeof getUpcomingInvoiceSchema>;
