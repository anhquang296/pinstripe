import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export const billingPortalConfigurationSchema = Type.Object({
  id: Type.String(),
  isActive: Type.Boolean(),
  isDefault: Type.Boolean(),
  businessName: Type.String(),
  defaultReturnUrl: Type.Union([Type.String(), Type.Null()]),
  features: Type.Object({
    canViewInvoiceHistory: Type.Boolean(),
    canUpdatePaymentMethod: Type.Boolean(),
    canCancelSubscription: Type.Boolean(),
  }),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const billingPortalSessionSchema = Type.Object({
  id: Type.String(),
  customerId: Type.String(),
  configurationId: Type.String(),
  portalSessionId: Type.String(),
  url: Type.String(),
  returnUrl: Type.Union([Type.String(), Type.Null()]),
  expiresAt: Type.String(),
  createdAt: Type.String(),
});

export const billingPortalConfigurationParamsSchema = Type.Object({
  configurationId: Type.String(),
});

export const billingPortalSessionParamsSchema = Type.Object({
  sessionId: Type.String(),
});

export const createBillingPortalConfigurationSchema = Type.Object(
  {
    businessName: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    defaultReturnUrl: Type.Optional(Type.String({ minLength: 1 })),
    isDefault: Type.Optional(Type.Boolean()),
    features: Type.Optional(
      Type.Object(
        {
          canViewInvoiceHistory: Type.Optional(Type.Boolean()),
          canUpdatePaymentMethod: Type.Optional(Type.Boolean()),
          canCancelSubscription: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const updateBillingPortalConfigurationSchema = Type.Object(
  {
    businessName: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    defaultReturnUrl: Type.Optional(Type.String({ minLength: 1 })),
    isActive: Type.Optional(Type.Boolean()),
    isDefault: Type.Optional(Type.Boolean()),
    features: Type.Optional(
      Type.Object(
        {
          canViewInvoiceHistory: Type.Optional(Type.Boolean()),
          canUpdatePaymentMethod: Type.Optional(Type.Boolean()),
          canCancelSubscription: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findBillingPortalConfigurationsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const createBillingPortalSessionSchema = Type.Object(
  {
    customerId: Type.String({ minLength: 1 }),
    configurationId: Type.Optional(Type.String({ minLength: 1 })),
    returnUrl: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export type BillingPortalConfigurationResponse = Static<typeof billingPortalConfigurationSchema>;
export type BillingPortalSessionResponse = Static<typeof billingPortalSessionSchema>;
export type CreateBillingPortalConfigurationPayload = Static<
  typeof createBillingPortalConfigurationSchema
>;
export type UpdateBillingPortalConfigurationPayload = Static<
  typeof updateBillingPortalConfigurationSchema
>;
export type FindBillingPortalConfigurationsQuery = Static<
  typeof findBillingPortalConfigurationsSchema
>;
export type CreateBillingPortalSessionPayload = Static<typeof createBillingPortalSessionSchema>;

export interface BillingPortalFeatures {
  canViewInvoiceHistory: boolean;
  canUpdatePaymentMethod: boolean;
  canCancelSubscription: boolean;
}
