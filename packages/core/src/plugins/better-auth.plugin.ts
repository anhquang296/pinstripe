import { AuthModelNameEnum, BetterAuthClient } from '@clients/better-auth.client';
import { adminSessions, authVerifications, userAccounts, users } from '@database/schemas';
import fp from 'fastify-plugin';

const AUTH_BASE_PATH = '/v1/auth';
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

export const betterAuthPlugin = fp(async (fastify) => {
  const {
    ADMIN_UI_ORIGIN,
    BETTER_AUTH_SECRET,
    ADMIN_SESSION_IDLE_TTL_MINUTES,
    ADMIN_SESSION_ABSOLUTE_TTL_HOURS,
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_ALLOWED_DOMAIN,
  } = fastify.config;

  const googleOauthConfig =
    GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && GOOGLE_OAUTH_ALLOWED_DOMAIN
      ? {
          clientId: GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
          allowedDomain: GOOGLE_OAUTH_ALLOWED_DOMAIN,
        }
      : null;

  const betterAuth = new BetterAuthClient(
    {
      database: fastify.database.master,
      authTables: {
        [AuthModelNameEnum.USERS]: users,
        [AuthModelNameEnum.ADMIN_SESSIONS]: adminSessions,
        [AuthModelNameEnum.USER_ACCOUNTS]: userAccounts,
        [AuthModelNameEnum.AUTH_VERIFICATIONS]: authVerifications,
      },
      baseUrl: ADMIN_UI_ORIGIN,
      basePath: AUTH_BASE_PATH,
      secret: BETTER_AUTH_SECRET,
      trustedOrigins: [ADMIN_UI_ORIGIN],
      sessionIdleTtlSeconds: ADMIN_SESSION_IDLE_TTL_MINUTES * SECONDS_PER_MINUTE,
      sessionAbsoluteTtlSeconds: ADMIN_SESSION_ABSOLUTE_TTL_HOURS * SECONDS_PER_HOUR,
      googleOauthConfig,
    },
    fastify.log,
  );

  fastify.decorate('betterAuth', betterAuth);
});
