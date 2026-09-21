import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { Default, loadEnvSchema, Optional } from '@vxrerp/platform/config';

export const billingEnvSchema = Type.Object({
  TEST_CLOCKS_ENABLED: Default(Type.Boolean(), false),

  PUBLIC_BASE_URL: Default(Type.String({ minLength: 1 }), 'http://localhost:3000'),
  PORTAL_BASE_URL: Default(Type.String({ minLength: 1 }), 'http://localhost:3100'),
  HOSTED_URL_SECRET: Default(
    Type.String({ minLength: 16 }),
    'vxrerp-hosted-url-development-secret',
  ),
  BANK_TRANSFER_BANK_BIN: Optional(Type.String({ pattern: '^[0-9]{6}$' })),
  BANK_TRANSFER_BANK_NAME: Optional(Type.String({ minLength: 1 })),
  BANK_TRANSFER_ACCOUNT_NUMBER: Optional(Type.String({ pattern: '^[0-9A-Za-z]{1,19}$' })),
  BANK_TRANSFER_ACCOUNT_NAME: Optional(Type.String({ minLength: 1 })),
  BILLING_OPS_EMAIL: Optional(Type.String({ minLength: 3 })),
  INVOICE_REMINDER_INTERVAL_MS: Default(Type.Integer({ minimum: 60_000 }), 3_600_000),
  PORTAL_LINK_TTL_MINUTES: Default(Type.Integer({ minimum: 1 }), 15),
  PORTAL_SESSION_TTL_MINUTES: Default(Type.Integer({ minimum: 1 }), 60),
  CHECKOUT_SESSION_TTL_MINUTES: Default(Type.Integer({ minimum: 1 }), 30),
  CHECKOUT_EXPIRE_POLL_INTERVAL_MS: Default(Type.Integer({ minimum: 100 }), 60_000),

  LEDGER_INTEGRITY_INTERVAL_MS: Default(Type.Integer({ minimum: 1000 }), 60_000),
  LEDGER_INTEGRITY_BATCH_SIZE: Default(Type.Integer({ minimum: 1 }), 100),

  METER_DEDUP_WINDOW_DAYS: Default(Type.Integer({ minimum: 1 }), 35),
  BILLING_RUN_SHARD_COUNT: Default(Type.Integer({ minimum: 1 }), 16),
  BILLING_RUN_INTERVAL_MS: Default(Type.Integer({ minimum: 1000 }), 60_000),
  BILLING_RUN_BATCH_SIZE: Default(Type.Integer({ minimum: 1 }), 100),
  BILLING_RUN_JITTER_MS: Default(Type.Integer({ minimum: 0 }), 5_000),
  PSP_REFERENCE_PREFIX: Default(Type.String({ minLength: 1 }), 'mockpsp'),
  PSP_AUTHENTICATION_URL: Default(Type.String({ minLength: 1 }), 'https://mock-psp.test/3ds'),
  PSP_WEBHOOK_SECRET: Optional(Type.String({ minLength: 16 })),
  PSP_CALLBACK_TOLERANCE_SECONDS: Default(Type.Integer({ minimum: 1 }), 300),
  PSP_CALLBACK_POLL_INTERVAL_MS: Default(Type.Integer({ minimum: 100 }), 2_000),
  PAYOUT_SETTLE_POLL_INTERVAL_MS: Default(Type.Integer({ minimum: 100 }), 60_000),
  VEXERE_API_URL: Optional(Type.String({ minLength: 1 })),
  VEXERE_API_KEY: Optional(Type.String({ minLength: 1 })),
  VEXERE_TIMEOUT_MS: Default(Type.Integer({ minimum: 100 }), 10_000),
  MOCK_VEXERE_BALANCES: Optional(Type.String({ minLength: 1 })),

  INVOICE_DUE_DAYS: Default(Type.Integer({ minimum: 0 }), 7),
  INVOICE_FINALIZE_DELAY_MS: Default(Type.Integer({ minimum: 0 }), 3_600_000),
  DUNNING_INTERVAL_MS: Default(Type.Integer({ minimum: 1000 }), 60_000),
  DUNNING_BATCH_SIZE: Default(Type.Integer({ minimum: 1 }), 100),
  DUNNING_JITTER_MS: Default(Type.Integer({ minimum: 0 }), 5_000),
  DUNNING_RETRY_DELAY_DAYS: Default(Type.String({ minLength: 1 }), '1,3,5,7'),
  DUNNING_IN_FLIGHT_TIMEOUT_MS: Default(Type.Integer({ minimum: 1000 }), 3_600_000),

  PORTAL_RATE_LIMIT: Default(Type.Integer({ minimum: 1 }), 10),
  PORTAL_RATE_WINDOW_SECONDS: Default(Type.Integer({ minimum: 1 }), 900),
});

export type BillingEnv = Static<typeof billingEnvSchema>;

export function loadBillingEnv(source: NodeJS.ProcessEnv): BillingEnv {
  return loadEnvSchema(billingEnvSchema, source);
}
