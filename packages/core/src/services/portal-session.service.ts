import { createHash, randomBytes } from 'node:crypto';

import type {
  CreatePortalLinkPayload,
  PortalAuth,
  PortalSessionResponse,
  RedeemPortalLinkPayload,
} from '@contracts/portal.types';
import { PortalSessionStatusEnum } from '@contracts/portal.types';
import type { Customer, PortalSession } from '@database/schemas';
import { NotFoundError, UnauthorizedError } from '@errors/app.error';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';

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

export interface MintedPortalSession {
  portalSessionId: string;
  sessionKey: string;
  sessionExpiresAt: string;
  url: string;
}

export class PortalSessionService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly portalSessionConfig: PortalSessionConfig,
  ) {}

  async createPortalLink(
    payload: CreatePortalLinkPayload,
    livemode: boolean,
  ): Promise<PortalLinkResult> {
    const now = this.fastify.clock.now();
    const linkExpiresAt = this.resolveLinkExpiry(now);
    const customer = await this.findCustomer(payload.email, livemode);

    if (!customer) {
      this.fastify.log.info(
        { livemode },
        '[PortalSessionService] createPortalLink() no customer matched the address',
      );

      return { linkKey: null, linkExpiresAt };
    }

    const linkKey = PortalSessionService.buildKey();
    const createdAt = now.toISOString();
    const portalSession = await this.fastify.portalSessionRepository.createPortalSession({
      id: generateGid(ObjectPrefixEnum.PORTAL_SESSION),
      livemode,
      customerId: customer.id,
      status: PortalSessionStatusEnum.PENDING,
      linkTokenHash: PortalSessionService.hashKey(linkKey),
      sessionTokenHash: null,
      linkExpiresAt: linkExpiresAt.toISOString(),
      sessionExpiresAt: null,
      redeemedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    if (!portalSession) {
      throw new NotFoundError('Portal session could not be created');
    }

    const url = this.buildMagicLinkUrl(linkKey);

    await this.fastify.notificationService.dispatchPortalMagicLink(portalSession, url);

    this.fastify.log.info(
      { portalSessionId: portalSession.id, customerId: customer.id },
      '[PortalSessionService] createPortalLink() success',
    );

    return { linkKey, linkExpiresAt };
  }

  async redeemPortalLink(
    payload: RedeemPortalLinkPayload,
    livemode: boolean,
  ): Promise<PortalSessionResponse> {
    const [portalSession] = await this.fastify.portalSessionRepository.findPortalSessions(
      { livemode, linkTokenHash: PortalSessionService.hashKey(payload.linkKey) },
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

  async createCustomerPortalSession(
    customerId: string,
    livemode: boolean,
  ): Promise<MintedPortalSession> {
    const customer = await this.getCustomer(customerId, livemode);
    const now = this.fastify.clock.now();
    const sessionKey = PortalSessionService.buildKey();
    const sessionExpiresAt = this.resolveSessionExpiry(now).toISOString();
    const redeemedAt = now.toISOString();
    const portalSession = await this.fastify.portalSessionRepository.createPortalSession({
      id: generateGid(ObjectPrefixEnum.PORTAL_SESSION),
      livemode,
      customerId: customer.id,
      status: PortalSessionStatusEnum.ACTIVE,
      linkTokenHash: PortalSessionService.hashKey(PortalSessionService.buildKey()),
      sessionTokenHash: PortalSessionService.hashKey(sessionKey),
      linkExpiresAt: this.resolveLinkExpiry(now).toISOString(),
      sessionExpiresAt,
      redeemedAt,
      createdAt: redeemedAt,
      updatedAt: redeemedAt,
    });

    if (portalSession) {
      return {
        portalSessionId: portalSession.id,
        sessionKey,
        sessionExpiresAt,
        url: this.buildSessionUrl(sessionKey),
      };
    }

    throw new NotFoundError('Portal session could not be created');
  }

  async authenticatePortalSession(sessionKey: string): Promise<PortalAuth> {
    const [portalSession] = await this.fastify.portalSessionRepository.findPortalSessions(
      { sessionTokenHash: PortalSessionService.hashKey(sessionKey) },
      1,
    );

    if (!portalSession || portalSession.status !== PortalSessionStatusEnum.ACTIVE) {
      throw new UnauthorizedError('Invalid portal session key provided');
    }

    const { sessionExpiresAt } = portalSession;

    if (sessionExpiresAt) {
      const sessionExpiry = new Date(sessionExpiresAt);
      const now = this.fastify.clock.now();

      if (sessionExpiry.getTime() > now.getTime()) {
        return {
          portalSessionId: portalSession.id,
          customerId: portalSession.customerId,
          livemode: portalSession.livemode,
        };
      }
    }

    throw new UnauthorizedError('This portal session has expired');
  }

  async revokePortalSession(id: string): Promise<PortalSessionResponse> {
    const portalSession = await this.getPortalSessionEntity(id);
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
    const portalSession = await this.getPortalSessionEntity(id);

    return PortalSessionService.buildPortalSession(portalSession, null);
  }

  buildMagicLinkUrl(linkKey: string): string {
    const { portalBaseUrl } = this.portalSessionConfig;

    return `${portalBaseUrl}/login?linkKey=${encodeURIComponent(linkKey)}`;
  }

  buildSessionUrl(sessionKey: string): string {
    const { portalBaseUrl } = this.portalSessionConfig;

    return `${portalBaseUrl}/login?sessionKey=${encodeURIComponent(sessionKey)}`;
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

  private async findCustomer(email: string, livemode: boolean): Promise<Customer | null> {
    const [customer] = await this.fastify.customerRepository.findCustomers({ livemode, email }, 1);

    return customer ?? null;
  }

  private async getCustomer(id: string, livemode: boolean): Promise<Customer> {
    const customer = await this.fastify.customerRepository.findCustomer(id);

    if (customer && customer.livemode === livemode) {
      return customer;
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  private async getPortalSessionEntity(id: string): Promise<PortalSession> {
    const portalSession = await this.fastify.portalSessionRepository.findPortalSession(id);

    if (portalSession) {
      return portalSession;
    }

    throw new NotFoundError(`No such portal session: ${id}`);
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
      livemode: entity.livemode,
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
