import { Default, Optional } from '@config/env-field';
import type { Static, TObject } from '@sinclair/typebox';
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
  REDIS_KEY_PREFIX: Default(Type.String({ minLength: 1 }), 'vxrerp'),

  SMTP_HOST: Optional(Type.String({ minLength: 1 })),
  SMTP_PORT: Optional(Type.Integer({ minimum: 1, maximum: 65535 })),
  SMTP_FROM_NAME: Default(Type.String({ minLength: 1 }), 'VXR ERP Billing'),
  SMTP_FROM_EMAIL: Default(Type.String({ minLength: 1 }), 'billing@vxrerp.test'),

  SECRET_API_KEY: Type.String({ minLength: 16 }),
  PORTAL_API_KEY: Optional(Type.String({ minLength: 16 })),

  ADMIN_UI_ORIGIN: Default(Type.String({ minLength: 1 }), 'http://localhost:5173'),
  BETTER_AUTH_SECRET: Default(
    Type.String({ minLength: 32 }),
    'vxrerp-better-auth-development-secret',
  ),
  ADMIN_SESSION_IDLE_TTL_MINUTES: Default(Type.Integer({ minimum: 1 }), 60),
  ADMIN_SESSION_ABSOLUTE_TTL_HOURS: Default(Type.Integer({ minimum: 1 }), 12),
  GOOGLE_OAUTH_CLIENT_ID: Optional(Type.String({ minLength: 1 })),
  GOOGLE_OAUTH_CLIENT_SECRET: Optional(Type.String({ minLength: 1 })),
  GOOGLE_OAUTH_ALLOWED_DOMAIN: Optional(Type.String({ minLength: 1 })),

  FILE_STORAGE_DIRECTORY: Default(Type.String({ minLength: 1 }), '.vxrerp-storage'),

  WORKFLOW_NAME: Optional(Type.String({ minLength: 1 })),
  WORKER_PORT: Default(Type.Integer({ minimum: 1, maximum: 65535 }), 3001),
  OUTBOX_RELAY_INTERVAL_MS: Default(Type.Integer({ minimum: 100 }), 5000),
  OUTBOX_RELAY_BATCH_SIZE: Default(Type.Integer({ minimum: 1 }), 100),

  IDEMPOTENCY_RETENTION_HOURS: Default(Type.Integer({ minimum: 1 }), 24),

  WEBHOOK_MAX_ATTEMPTS: Default(Type.Integer({ minimum: 1 }), 5),
  WEBHOOK_BACKOFF_MS: Default(Type.Integer({ minimum: 100 }), 2_000),
  WEBHOOK_TIMEOUT_MS: Default(Type.Integer({ minimum: 100 }), 5_000),
  WEBHOOK_ENDPOINT_RATE_LIMIT: Default(Type.Integer({ minimum: 1 }), 60),
  WEBHOOK_ENDPOINT_RATE_WINDOW_SECONDS: Default(Type.Integer({ minimum: 1 }), 60),
  API_RATE_LIMIT: Default(Type.Integer({ minimum: 1 }), 1000),
  API_RATE_WINDOW_SECONDS: Default(Type.Integer({ minimum: 1 }), 60),
});

export type Env = Static<typeof envSchema>;

export function loadEnvSchema<TSchema extends TObject>(
  schema: TSchema,
  source: NodeJS.ProcessEnv,
): Static<TSchema> {
  const withoutEmpty = _.omitBy(source, (value) => {
    return value === undefined || value === '';
  });

  const candidate = Value.Default(schema, Value.Convert(schema, withoutEmpty));
  const errors = [...Value.Errors(schema, candidate)];

  if (!_.isEmpty(errors)) {
    const reason = _(errors)
      .map((error) => {
        return `${error.path || '/'} ${error.message}`;
      })
      .join('; ');

    throw new Error(`loadEnvSchema() invalid environment: ${reason}`);
  }

  return candidate as Static<TSchema>;
}

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  return loadEnvSchema(envSchema, source);
}
