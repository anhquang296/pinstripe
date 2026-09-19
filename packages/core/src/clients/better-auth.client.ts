import type { UserRole } from '@contracts/users.types';
import { UserRoleEnum } from '@contracts/users.types';
import type { Database } from '@database/database.client';
import type { Logger } from '@type/logger';
import type { ObjectPrefix } from '@utils/gid-factory';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { betterAuth as createBetterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Role } from 'better-auth/plugins/access';
import { createAccessControl } from 'better-auth/plugins/access';
import { admin } from 'better-auth/plugins/admin';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';
import type { PgTable } from 'drizzle-orm/pg-core';
import _ from 'lodash';

const CREDENTIAL_PROVIDER_ID = 'credential';
const SESSION_UPDATE_AGE_SECONDS = 300;
const MIN_PASSWORD_LENGTH = 12;
const MS_PER_SECOND = 1000;

const VENDOR_MODEL_PREFIXES: Record<string, ObjectPrefix> = {
  user: ObjectPrefixEnum.USER,
  session: ObjectPrefixEnum.ADMIN_SESSION,
  account: ObjectPrefixEnum.USER_ACCOUNT,
  verification: ObjectPrefixEnum.AUTH_VERIFICATION,
};

type VendorLogLevel = 'debug' | 'info' | 'warn' | 'error';

export enum AuthModelNameEnum {
  USERS = 'users',
  ADMIN_SESSIONS = 'admin_sessions',
  USER_ACCOUNTS = 'user_accounts',
  AUTH_VERIFICATIONS = 'auth_verifications',
}
export type AuthModelName = `${AuthModelNameEnum}`;

export type GoogleOauthConfig = {
  clientId: string;
  clientSecret: string;
  allowedDomain: string;
};

export type BetterAuthConfig = {
  database: Database;
  authTables: Record<AuthModelName, PgTable>;
  baseUrl: string;
  basePath: string;
  secret: string;
  trustedOrigins: string[];
  sessionIdleTtlSeconds: number;
  sessionAbsoluteTtlSeconds: number;
  googleOauthConfig: GoogleOauthConfig | null;
};

export interface CreateAuthUserPayload {
  email: string;
  name: string;
  role: UserRole;
  password?: string;
}

export interface UpdateAuthUserPayload {
  name?: string;
  role?: UserRole;
  banned?: boolean;
}

export class BetterAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BetterAuthConfigError';
  }
}

export class BetterAuthClient {
  private _auth: ReturnType<typeof BetterAuthClient.buildAuth>;
  private _baseUrl: string;
  private _sessionAbsoluteTtlSeconds: number;
  private _isGoogleEnabled: boolean;
  private _logger: Logger;

  constructor(betterAuthConfig: BetterAuthConfig, logger: Logger) {
    const { baseUrl, sessionAbsoluteTtlSeconds, googleOauthConfig } = betterAuthConfig;

    this._auth = BetterAuthClient.buildAuth(betterAuthConfig, logger);
    this._baseUrl = baseUrl;
    this._sessionAbsoluteTtlSeconds = sessionAbsoluteTtlSeconds;
    this._isGoogleEnabled = googleOauthConfig !== null;
    this._logger = logger;
  }

  get baseUrl(): string {
    return this._baseUrl;
  }

  get isGoogleEnabled(): boolean {
    return this._isGoogleEnabled;
  }

  handler(request: Request): Promise<Response> {
    return this._auth.handler(request);
  }

  async getSession(headers: Headers) {
    return this._auth.api.getSession({ headers, query: { disableCookieCache: true } });
  }

  async findActiveSession(headers: Headers) {
    const authSession = await this.getSession(headers);

    if (!authSession) {
      return null;
    }

    const { session } = authSession;
    const absoluteExpiresAt =
      session.createdAt.getTime() + this._sessionAbsoluteTtlSeconds * MS_PER_SECOND;

    if (absoluteExpiresAt > Date.now()) {
      return authSession;
    }

    await this.revokeSession(session.token);

    this._logger.info(
      { sessionId: session.id, userId: session.userId },
      '[BetterAuthClient] findActiveSession() session revoked, absolute ttl reached',
    );

    return null;
  }

  async revokeSession(token: string): Promise<void> {
    const context = await this._auth.$context;

    await context.internalAdapter.deleteSession(token);
  }

  async revokeUserSessions(userId: string): Promise<void> {
    const context = await this._auth.$context;

    await context.internalAdapter.deleteUserSessions(userId);

    this._logger.info({ userId }, '[BetterAuthClient] revokeUserSessions() success');
  }

  async createUser(payload: CreateAuthUserPayload): Promise<string> {
    const { user } = await this._auth.api.createUser({
      body: {
        email: payload.email,
        name: payload.name,
        role: payload.role,
        password: payload.password,
      },
    });

    return user.id;
  }

  async updateUser(userId: string, payload: UpdateAuthUserPayload): Promise<void> {
    const context = await this._auth.$context;

    await context.internalAdapter.updateUser(userId, _.omitBy(payload, _.isUndefined));
  }

  async setUserPassword(userId: string, password: string): Promise<void> {
    const context = await this._auth.$context;
    const passwordHash = await context.password.hash(password);
    const credentialAccount = await context.internalAdapter.findCredentialAccount(userId);

    if (credentialAccount) {
      await context.internalAdapter.updatePassword(userId, passwordHash);

      return;
    }

    await context.internalAdapter.linkAccount({
      userId,
      providerId: CREDENTIAL_PROVIDER_ID,
      accountId: userId,
      password: passwordHash,
    });
  }

  private static buildAuth(betterAuthConfig: BetterAuthConfig, logger: Logger) {
    const {
      database,
      authTables,
      baseUrl,
      basePath,
      secret,
      trustedOrigins,
      sessionIdleTtlSeconds,
      googleOauthConfig,
    } = betterAuthConfig;

    const accessControl = createAccessControl(defaultStatements);
    const adminRole = accessControl.newRole({ ...adminAc.statements });
    const staffRole = accessControl.newRole({ user: [], session: [] });
    const roles: Record<UserRole, Role> = {
      [UserRoleEnum.ADMIN]: adminRole,
      [UserRoleEnum.MODERATOR]: staffRole,
      [UserRoleEnum.MEMBER]: staffRole,
    };

    return createBetterAuth({
      baseURL: baseUrl,
      basePath,
      secret,
      trustedOrigins,
      telemetry: { enabled: false },
      rateLimit: { enabled: false },
      logger: {
        log: (level, message, ...args) => {
          BetterAuthClient.forwardVendorLog(logger, level, message, args);
        },
      },
      database: drizzleAdapter(database, { provider: 'pg', schema: authTables }),
      user: { modelName: AuthModelNameEnum.USERS },
      session: {
        modelName: AuthModelNameEnum.ADMIN_SESSIONS,
        expiresIn: sessionIdleTtlSeconds,
        updateAge: SESSION_UPDATE_AGE_SECONDS,
      },
      account: {
        modelName: AuthModelNameEnum.USER_ACCOUNTS,
        accountLinking: { enabled: true, trustedProviders: ['google'] },
      },
      verification: { modelName: AuthModelNameEnum.AUTH_VERIFICATIONS },
      advanced: {
        cookiePrefix: 'pinstripe',
        database: { generateId: BetterAuthClient.buildId },
      },
      emailAndPassword: {
        enabled: true,
        disableSignUp: true,
        minPasswordLength: MIN_PASSWORD_LENGTH,
      },
      socialProviders: googleOauthConfig
        ? {
            google: {
              clientId: googleOauthConfig.clientId,
              clientSecret: googleOauthConfig.clientSecret,
              hd: googleOauthConfig.allowedDomain,
              disableImplicitSignUp: true,
            },
          }
        : {},
      plugins: [
        admin({
          ac: accessControl,
          roles,
          defaultRole: UserRoleEnum.MEMBER,
          adminRoles: [UserRoleEnum.ADMIN],
        }),
      ],
    });
  }

  private static buildId({ model }: { model: string }): string {
    const prefix = _.get(VENDOR_MODEL_PREFIXES, model);

    if (prefix) {
      return generateGid(prefix);
    }

    throw new BetterAuthConfigError(`No id prefix is registered for the ${model} model`);
  }

  private static forwardVendorLog(
    logger: Logger,
    level: VendorLogLevel,
    message: string,
    args: unknown[],
  ): void {
    if (level === 'error') {
      const [error] = args;

      logger.error({ error, vendorMessage: message }, '[BetterAuthClient] log() error');

      return;
    }

    logger[level]({ vendorMessage: message, args }, '[BetterAuthClient] log() forwarded');
  }
}
