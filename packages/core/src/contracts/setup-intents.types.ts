import type {
  FailureCode,
  NextActionType,
  PaymentCancellationReason,
} from '@contracts/payments.types';
import {
  FailureCodeEnum,
  NextActionTypeEnum,
  PaymentCancellationReasonEnum,
} from '@contracts/payments.types';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum SetupIntentStatusEnum {
  REQUIRES_PAYMENT_METHOD = 'requires_payment_method',
  REQUIRES_CONFIRMATION = 'requires_confirmation',
  REQUIRES_ACTION = 'requires_action',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  CANCELED = 'canceled',
}
export type SetupIntentStatus = `${SetupIntentStatusEnum}`;

export enum SetupIntentUsageEnum {
  OFF_SESSION = 'off_session',
  ON_SESSION = 'on_session',
}
export type SetupIntentUsage = `${SetupIntentUsageEnum}`;

export const SETUP_INTENT_TRANSITIONS: Record<SetupIntentStatus, SetupIntentStatus[]> = {
  [SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD]: [
    SetupIntentStatusEnum.REQUIRES_CONFIRMATION,
    SetupIntentStatusEnum.PROCESSING,
    SetupIntentStatusEnum.REQUIRES_ACTION,
    SetupIntentStatusEnum.CANCELED,
  ],
  [SetupIntentStatusEnum.REQUIRES_CONFIRMATION]: [
    SetupIntentStatusEnum.PROCESSING,
    SetupIntentStatusEnum.REQUIRES_ACTION,
    SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
    SetupIntentStatusEnum.CANCELED,
  ],
  [SetupIntentStatusEnum.REQUIRES_ACTION]: [
    SetupIntentStatusEnum.PROCESSING,
    SetupIntentStatusEnum.SUCCEEDED,
    SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
    SetupIntentStatusEnum.CANCELED,
  ],
  [SetupIntentStatusEnum.PROCESSING]: [
    SetupIntentStatusEnum.SUCCEEDED,
    SetupIntentStatusEnum.REQUIRES_ACTION,
    SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
    SetupIntentStatusEnum.CANCELED,
  ],
  [SetupIntentStatusEnum.SUCCEEDED]: [],
  [SetupIntentStatusEnum.CANCELED]: [],
};

export const setupIntentSchema = Type.Object({
  object: Type.Literal('setup_intent'),
  id: Type.String(),
  customerId: Type.String(),
  customer: Type.Optional(Type.Unknown()),
  status: Type.Unsafe<SetupIntentStatus>(Type.Enum(SetupIntentStatusEnum)),
  usage: Type.Unsafe<SetupIntentUsage>(Type.Enum(SetupIntentUsageEnum)),
  paymentMethodId: Type.Union([Type.String(), Type.Null()]),
  nextAction: Type.Union([
    Type.Object({
      type: Type.Unsafe<NextActionType>(Type.Enum(NextActionTypeEnum)),
      redirectUrl: Type.String(),
    }),
    Type.Null(),
  ]),
  cancellationReason: Type.Union([
    Type.Unsafe<PaymentCancellationReason>(Type.Enum(PaymentCancellationReasonEnum)),
    Type.Null(),
  ]),
  pspReference: Type.Union([Type.String(), Type.Null()]),
  failureCode: Type.Union([Type.Unsafe<FailureCode>(Type.Enum(FailureCodeEnum)), Type.Null()]),
  failureMessage: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.String()),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const setupIntentParamsSchema = Type.Object({
  setupIntentId: Type.String(),
});

export const createSetupIntentSchema = Type.Object(
  {
    customerId: Type.String({ minLength: 1 }),
    paymentMethodId: Type.Optional(Type.String({ minLength: 1 })),
    usage: Type.Optional(Type.Unsafe<SetupIntentUsage>(Type.Enum(SetupIntentUsageEnum))),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const confirmSetupIntentSchema = Type.Object(
  {
    paymentMethodId: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const cancelSetupIntentSchema = Type.Object(
  {
    cancellationReason: Type.Optional(
      Type.Unsafe<PaymentCancellationReason>(Type.Enum(PaymentCancellationReasonEnum)),
    ),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  },
  { additionalProperties: false },
);

export const findSetupIntentsSchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
    customerId: Type.Optional(Type.String()),
    status: Type.Optional(Type.Unsafe<SetupIntentStatus>(Type.Enum(SetupIntentStatusEnum))),
    expand: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

export type SetupIntentResponse = Static<typeof setupIntentSchema>;
export type CreateSetupIntentPayload = Static<typeof createSetupIntentSchema>;
export type ConfirmSetupIntentPayload = Static<typeof confirmSetupIntentSchema>;
export type CancelSetupIntentPayload = Static<typeof cancelSetupIntentSchema>;
export type FindSetupIntentsQuery = Static<typeof findSetupIntentsSchema>;
