import { Default, Optional } from '@config/env-field';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import _ from 'lodash';

export enum NodeEnvEnum {
  DEVELOPMENT = 'development',
  TEST = 'test',
  PRODUCTION = 'production',
}
export type NodeEnv = `${NodeEnvEnum}`;

export enum LogLevelEnum {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}
export type LogLevel = `${LogLevelEnum}`;

export const envSchema = Type.Object({
  NODE_ENV: Default(Type.Enum(NodeEnvEnum), NodeEnvEnum.DEVELOPMENT),
  LOG_LEVEL: Default(Type.Enum(LogLevelEnum), LogLevelEnum.INFO),

  API_PORT: Default(Type.Integer({ minimum: 1, maximum: 65535 }), 3000),
  API_HOST: Default(Type.String({ minLength: 1 }), '0.0.0.0'),

  DATABASE_URL: Type.String({ minLength: 1 }),
  DATABASE_POOL_MAX: Default(Type.Integer({ minimum: 1 }), 10),

  REDIS_HOST: Default(Type.String({ minLength: 1 }), 'localhost'),
  REDIS_PORT: Default(Type.Integer({ minimum: 1, maximum: 65535 }), 6379),
  REDIS_PASSWORD: Optional(Type.String({ minLength: 1 })),
  REDIS_KEY_PREFIX: Default(Type.String({ minLength: 1 }), 'pinstripe'),

  SMTP_HOST: Optional(Type.String({ minLength: 1 })),
  SMTP_PORT: Optional(Type.Integer({ minimum: 1, maximum: 65535 })),
  SMTP_FROM_NAME: Default(Type.String({ minLength: 1 }), 'Pinstripe Billing'),
  SMTP_FROM_EMAIL: Default(Type.String({ minLength: 1 }), 'billing@pinstripe.test'),

  SECRET_API_KEY: Type.String({ minLength: 16 }),
  ADMIN_API_KEY: Type.String({ minLength: 16 }),
  SYSTEM_API_KEY: Type.String({ minLength: 16 }),
  MANAGEMENT_API_KEY: Type.String({ minLength: 16 }),
  PORTAL_API_KEY: Optional(Type.String({ minLength: 16 })),

  TEST_CLOCKS_ENABLED: Default(Type.Boolean(), false),

  ADMIN_UI_ORIGIN: Default(Type.String({ minLength: 1 }), 'http://localhost:5173'),
  BETTER_AUTH_SECRET: Default(
    Type.String({ minLength: 32 }),
    'pinstripe-better-auth-development-secret',
  ),
  ADMIN_SESSION_IDLE_TTL_MINUTES: Default(Type.Integer({ minimum: 1 }), 60),
  ADMIN_SESSION_ABSOLUTE_TTL_HOURS: Default(Type.Integer({ minimum: 1 }), 12),
  GOOGLE_OAUTH_CLIENT_ID: Optional(Type.String({ minLength: 1 })),
  GOOGLE_OAUTH_CLIENT_SECRET: Optional(Type.String({ minLength: 1 })),
  GOOGLE_OAUTH_ALLOWED_DOMAIN: Optional(Type.String({ minLength: 1 })),

  PUBLIC_BASE_URL: Default(Type.String({ minLength: 1 }), 'http://localhost:3000'),
  PORTAL_BASE_URL: Default(Type.String({ minLength: 1 }), 'http://localhost:3100'),
  HOSTED_URL_SECRET: Default(
    Type.String({ minLength: 16 }),
    'pinstripe-hosted-url-development-secret',
  ),
  FILE_STORAGE_DIRECTORY: Default(Type.String({ minLength: 1 }), '.pinstripe-storage'),
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

  WORKFLOW_NAME: Optional(Type.String({ minLength: 1 })),
  WORKER_PORT: Default(Type.Integer({ minimum: 1, maximum: 65535 }), 3001),
  OUTBOX_RELAY_INTERVAL_MS: Default(Type.Integer({ minimum: 100 }), 5000),
  OUTBOX_RELAY_BATCH_SIZE: Default(Type.Integer({ minimum: 1 }), 100),

  LEDGER_INTEGRITY_INTERVAL_MS: Default(Type.Integer({ minimum: 1000 }), 60_000),
  LEDGER_INTEGRITY_BATCH_SIZE: Default(Type.Integer({ minimum: 1 }), 100),

  IDEMPOTENCY_RETENTION_HOURS: Default(Type.Integer({ minimum: 1 }), 24),
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

  INVOICE_DUE_DAYS: Default(Type.Integer({ minimum: 0 }), 7),
  INVOICE_FINALIZE_DELAY_MS: Default(Type.Integer({ minimum: 0 }), 3_600_000),
  DUNNING_INTERVAL_MS: Default(Type.Integer({ minimum: 1000 }), 60_000),
  DUNNING_BATCH_SIZE: Default(Type.Integer({ minimum: 1 }), 100),
  DUNNING_JITTER_MS: Default(Type.Integer({ minimum: 0 }), 5_000),
  DUNNING_RETRY_DELAY_DAYS: Default(Type.String({ minLength: 1 }), '1,3,5,7'),
  DUNNING_IN_FLIGHT_TIMEOUT_MS: Default(Type.Integer({ minimum: 1000 }), 3_600_000),

  WEBHOOK_MAX_ATTEMPTS: Default(Type.Integer({ minimum: 1 }), 5),
  WEBHOOK_BACKOFF_MS: Default(Type.Integer({ minimum: 100 }), 2_000),
  WEBHOOK_TIMEOUT_MS: Default(Type.Integer({ minimum: 100 }), 5_000),
  WEBHOOK_ENDPOINT_RATE_LIMIT: Default(Type.Integer({ minimum: 1 }), 60),
  WEBHOOK_ENDPOINT_RATE_WINDOW_SECONDS: Default(Type.Integer({ minimum: 1 }), 60),
  API_RATE_LIMIT: Default(Type.Integer({ minimum: 1 }), 1000),
  API_RATE_WINDOW_SECONDS: Default(Type.Integer({ minimum: 1 }), 60),
  PORTAL_RATE_LIMIT: Default(Type.Integer({ minimum: 1 }), 10),
  PORTAL_RATE_WINDOW_SECONDS: Default(Type.Integer({ minimum: 1 }), 900),
});

export type Env = Static<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const withoutEmpty = _.omitBy(source, (value) => {
    return value === undefined || value === '';
  });

  const candidate = Value.Default(envSchema, Value.Convert(envSchema, withoutEmpty));
  const errors = [...Value.Errors(envSchema, candidate)];

  if (!_.isEmpty(errors)) {
    const reason = _(errors)
      .map((error) => {
        return `${error.path || '/'} ${error.message}`;
      })
      .join('; ');

    throw new Error(`loadEnv() invalid environment: ${reason}`);
  }

  return candidate as Env;
}
