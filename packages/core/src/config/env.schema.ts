import { Default, Optional, Required } from '@config/env-field';
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

  DATABASE_URL: Required(Type.String({ minLength: 1 })),
  DATABASE_POOL_MAX: Default(Type.Integer({ minimum: 1 }), 10),

  REDIS_HOST: Default(Type.String({ minLength: 1 }), 'localhost'),
  REDIS_PORT: Default(Type.Integer({ minimum: 1, maximum: 65535 }), 6379),
  REDIS_PASSWORD: Optional(Type.String({ minLength: 1 })),
  REDIS_KEY_PREFIX: Default(Type.String({ minLength: 1 }), 'pinstripe'),

  SMTP_HOST: Optional(Type.String({ minLength: 1 })),
  SMTP_PORT: Optional(Type.Integer({ minimum: 1, maximum: 65535 })),

  SECRET_API_KEY: Required(Type.String({ minLength: 16 })),
  ADMIN_API_KEY: Required(Type.String({ minLength: 16 })),
  SYSTEM_API_KEY: Required(Type.String({ minLength: 16 })),
  MANAGEMENT_API_KEY: Required(Type.String({ minLength: 16 })),
  WEBHOOK_SIGNING_SECRET: Required(Type.String({ minLength: 16 })),

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
});

export type Env = Static<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const withoutEmpty = Object.fromEntries(
    Object.entries(source).filter(([, value]) => {
      return value !== undefined && value !== '';
    }),
  );
  const candidate = Value.Default(envSchema, Value.Convert(envSchema, withoutEmpty));
  const errors = [...Value.Errors(envSchema, candidate)];

  if (errors.length > 0) {
    const details = _(errors)
      .map((error) => {
        return `${error.path || '/'} ${error.message}`;
      })
      .join('; ');

    throw new Error(`loadEnv() invalid environment: ${details}`);
  }

  return candidate as Env;
}
