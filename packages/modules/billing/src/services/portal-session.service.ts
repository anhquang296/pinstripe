import { createHash, randomBytes } from 'node:crypto';

import type {
  CreatePortalLinkPayload,
  PortalAuth,
  PortalSessionResponse,
  RedeemPortalLinkPayload,
} from '@contracts/portal.types';
import { PortalSessionStatusEnum } from '@contracts/portal.types';
import type { PortalRole } from '@contracts/portal-memberships.types';
import type { PortalSession } from '@database/schemas';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@vxrerp/platform/errors';
import { generateGid, ObjectPrefixEnum } from '@vxrerp/platform/utils';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const TOKEN_BYTE_LENGTH = 32;
const MILLISECONDS_PER_MINUTE = 60_000;

export interface PortalSessionConfig {
  linkTtlMinutes: number;
  sessionTtlMinutes: number;
  portalBaseUrl: string;
}

export interface PortalLinkResult {
  linkKey: string | null;
  linkExpiresAt: Date;
}

export interface CustomerPortalLink {
  portalSessionId: string;
  linkExpiresAt: string;
  url: string;
}

interface PendingPortalSession {
  portalSession: PortalSession;
  linkKey: string;
}

export class PortalSessionService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly portalSessionConfig: PortalSessionConfig,
  ) {}

  async createPortalLink(payload: CreatePortalLinkPayload): Promise<PortalLinkResult> {
    const now = this.fastify.clock.now();
    const linkExpiresAt = this.resolveLinkExpiry(now);
    const portalLogin = await this.fastify.portalUserService.resolvePortalLogin(payload.email);

    if (portalLogin) {
      const { portalUser, portalMembership } = portalLogin;

      const { portalSession, linkKey } = await this.createPendingPortalSession(
        portalMembership.customerId,
        portalUser.id,
        now,
        linkExpiresAt,
      );

      const url = this.buildMagicLinkUrl(linkKey);

      await this.fastify.notificationService.dispatchPortalMagicLink(portalSession, url, {
        recipient: portalUser.email,
      });

      this.fastify.log.info(
        { portalSessionId: portalSession.id, customerId: portalMembership.customerId },
        '[PortalSessionService] createPortalLink() success',
      );

      return { linkKey, linkExpiresAt };
    }

    this.fastify.log.info(
      '[PortalSessionService] createPortalLink() no portal user matched the address',
    );

    return { linkKey: null, linkExpiresAt };
  }

  async redeemPortalLink(payload: RedeemPortalLinkPayload): Promise<PortalSessionResponse> {
    const [portalSession] = await this.fastify.portalSessionRepository.findPortalSessions(
      { linkTokenHash: PortalSessionService.hashKey(payload.linkKey) },
      1,
    );

    const now = this.fastify.clock.now();

    if (!portalSession || portalSession.status !== PortalSessionStatusEnum.PENDING) {
      throw new UnauthorizedError('This portal link is not valid');
    }

    const linkExpiresAt = new Date(portalSession.linkExpiresAt);

    if (linkExpiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedError('This portal link has expired');
    }

    const sessionKey = PortalSessionService.buildKey();
    const redeemedAt = now.toISOString();

    const activated = await this.fastify.portalSessionRepository.updatePortalSession(
      portalSession.id,
      {
        status: PortalSessionStatusEnum.ACTIVE,
        sessionTokenHash: PortalSessionService.hashKey(sessionKey),
        sessionExpiresAt: this.resolveSessionExpiry(now).toISOString(),
        redeemedAt,
        updatedAt: redeemedAt,
      },
    );

    if (activated) {
      return PortalSessionService.buildPortalSession(activated, sessionKey);
    }

    throw new NotFoundError(`No such portal session: ${portalSession.id}`);
  }

  async createCustomerPortalLink(customerId: string): Promise<CustomerPortalLink> {
    const customer = await this.fastify.customerRepository.getCustomer(customerId);
    const now = this.fastify.clock.now();
    const linkExpiresAt = this.resolveLinkExpiry(now);

    const { portalSession, linkKey } = await this.createPendingPortalSession(
      customer.id,
      null,
      now,
      linkExpiresAt,
    );

    return {
      portalSessionId: portalSession.id,
      linkExpiresAt: portalSession.linkExpiresAt,
      url: this.buildMagicLinkUrl(linkKey),
    };
  }

  async authenticatePortalSession(sessionKey: string): Promise<PortalAuth> {
    const [portalSession] = await this.fastify.portalSessionRepository.findPortalSessions(
      { sessionTokenHash: PortalSessionService.hashKey(sessionKey) },
      1,
    );

    const now = this.fastify.clock.now();
    const sessionExpiresAt = _.get(portalSession, 'sessionExpiresAt', null);

    const isLive =
      _.get(portalSession, 'status') === PortalSessionStatusEnum.ACTIVE &&
      sessionExpiresAt !== null &&
      new Date(sessionExpiresAt).getTime() > now.getTime();

    if (portalSession && isLive) {
      const { portalUserId } = portalSession;

      const role = await this.resolveSessionRole(portalUserId, portalSession.customerId);

      return {
        portalSessionId: portalSession.id,
        customerId: portalSession.customerId,
        portalUserId,
        role,
      };
    }

    throw new UnauthorizedError('Invalid or expired portal session key provided');
  }

  async switchPortalSessionCustomer(
    portalAuth: PortalAuth,
    customerId: string,
  ): Promise<PortalSessionResponse> {
    const { portalUserId, portalSessionId } = portalAuth;

    if (portalUserId) {
      await this.fastify.portalUserService.getSessionMembership(portalUserId, customerId);

      const updatedAt = this.fastify.clock.now().toISOString();

      const portalSession = await this.fastify.portalSessionRepository.updatePortalSession(
        portalSessionId,
        { customerId, updatedAt },
      );

      if (portalSession) {
        return PortalSessionService.buildPortalSession(portalSession, null);
      }

      throw new NotFoundError(`No such portal session: ${portalSessionId}`);
    }

    throw new ForbiddenError('A portal link opened by Vexere is bound to one operator');
  }

  private async resolveSessionRole(
    portalUserId: string | null,
    customerId: string,
  ): Promise<PortalRole | null> {
    if (portalUserId) {
      const portalMembership = await this.fastify.portalUserService.getSessionMembership(
        portalUserId,
        customerId,
      );

      return portalMembership.role;
    }

    return null;
  }

  async revokePortalSession(id: string): Promise<PortalSessionResponse> {
    const portalSession = await this.fastify.portalSessionRepository.getPortalSession(id);
    const updatedAt = this.fastify.clock.now().toISOString();

    const revoked = await this.fastify.portalSessionRepository.updatePortalSession(
      portalSession.id,
      { status: PortalSessionStatusEnum.REVOKED, updatedAt },
    );

    if (revoked) {
      return PortalSessionService.buildPortalSession(revoked, null);
    }

    throw new NotFoundError(`No such portal session: ${id}`);
  }

  async getPortalSession(id: string): Promise<PortalSessionResponse> {
    const portalSession = await this.fastify.portalSessionRepository.getPortalSession(id);

    return PortalSessionService.buildPortalSession(portalSession, null);
  }

  buildMagicLinkUrl(linkKey: string): string {
    const { portalBaseUrl } = this.portalSessionConfig;

    return `${portalBaseUrl}/login/verify?linkKey=${encodeURIComponent(linkKey)}`;
  }

  private async createPendingPortalSession(
    customerId: string,
    portalUserId: string | null,
    now: Date,
    linkExpiresAt: Date,
  ): Promise<PendingPortalSession> {
    const linkKey = PortalSessionService.buildKey();
    const createdAt = now.toISOString();

    const portalSession = await this.fastify.portalSessionRepository.createPortalSession({
      id: generateGid(ObjectPrefixEnum.PORTAL_SESSION),
      customerId,
      portalUserId,
      status: PortalSessionStatusEnum.PENDING,
      linkTokenHash: PortalSessionService.hashKey(linkKey),
      sessionTokenHash: null,
      linkExpiresAt: linkExpiresAt.toISOString(),
      sessionExpiresAt: null,
      redeemedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    if (portalSession) {
      return { portalSession, linkKey };
    }

    throw new NotFoundError('Portal session could not be created');
  }

  private resolveLinkExpiry(now: Date): Date {
    return new Date(
      now.getTime() + this.portalSessionConfig.linkTtlMinutes * MILLISECONDS_PER_MINUTE,
    );
  }

  private resolveSessionExpiry(now: Date): Date {
    return new Date(
      now.getTime() + this.portalSessionConfig.sessionTtlMinutes * MILLISECONDS_PER_MINUTE,
    );
  }

  private static buildKey(): string {
    return randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
  }

  private static hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private static buildPortalSession(
    entity: PortalSession,
    sessionKey: string | null,
  ): PortalSessionResponse {
    return {
      id: entity.id,
      customerId: entity.customerId,
      status: entity.status,
      sessionKey,
      linkExpiresAt: entity.linkExpiresAt,
      sessionExpiresAt: entity.sessionExpiresAt,
      redeemedAt: entity.redeemedAt,
      createdAt: entity.createdAt,
    };
  }
}
