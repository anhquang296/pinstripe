import type {
  BillingPortalConfigurationResponse,
  BillingPortalFeatures,
  BillingPortalSessionResponse,
  CreateBillingPortalConfigurationPayload,
  CreateBillingPortalSessionPayload,
  FindBillingPortalConfigurationsQuery,
  UpdateBillingPortalConfigurationPayload,
} from '@contracts/billing-portal.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { BillingPortalConfiguration, BillingPortalSession } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DEFAULT_BUSINESS_NAME = 'Pinstripe Billing';

const DEFAULT_FEATURES: BillingPortalFeatures = {
  canViewInvoiceHistory: true,
  canUpdatePaymentMethod: true,
  canCancelSubscription: true,
};

export class BillingPortalService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createConfiguration(
    payload: CreateBillingPortalConfigurationPayload,
    livemode: boolean,
  ): Promise<BillingPortalConfigurationResponse> {
    const now = this.fastify.clock.now();
    const isDefault = payload.isDefault ?? false;
    const id = generateGid(ObjectPrefixEnum.BILLING_PORTAL_CONFIGURATION);

    const configuration = await this.fastify.database.master.transaction(async (tx) => {
      if (isDefault) {
        await this.fastify.billingPortalConfigurationRepository.demoteBillingPortalConfigurations(
          livemode,
          tx,
        );
      }

      return this.fastify.billingPortalConfigurationRepository.createBillingPortalConfiguration(
        {
          id,
          livemode,
          isActive: true,
          isDefault,
          businessName: payload.businessName ?? DEFAULT_BUSINESS_NAME,
          defaultReturnUrl: payload.defaultReturnUrl ?? null,
          features: { ...DEFAULT_FEATURES, ...payload.features },
          metadata: payload.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        },
        tx,
      );
    });

    if (configuration) {
      return BillingPortalService.buildConfiguration(configuration);
    }

    throw new NotFoundError(`Billing portal configuration ${id} could not be created`);
  }

  async updateConfiguration(
    id: string,
    payload: UpdateBillingPortalConfigurationPayload,
    livemode: boolean,
  ): Promise<BillingPortalConfigurationResponse> {
    const configuration = await this.getConfigurationEntity(id, livemode);
    const now = this.fastify.clock.now();

    const updatedConfiguration = await this.fastify.database.master.transaction(async (tx) => {
      if (payload.isDefault) {
        await this.fastify.billingPortalConfigurationRepository.demoteBillingPortalConfigurations(
          livemode,
          tx,
        );
      }

      return this.fastify.billingPortalConfigurationRepository.updateBillingPortalConfiguration(
        configuration.id,
        {
          isActive: payload.isActive ?? configuration.isActive,
          isDefault: payload.isDefault ?? configuration.isDefault,
          businessName: payload.businessName ?? configuration.businessName,
          defaultReturnUrl: payload.defaultReturnUrl ?? configuration.defaultReturnUrl,
          features: { ...configuration.features, ...payload.features },
          metadata: { ...configuration.metadata, ...payload.metadata },
          updatedAt: now,
        },
        tx,
      );
    });

    if (updatedConfiguration) {
      return BillingPortalService.buildConfiguration(updatedConfiguration);
    }

    throw new NotFoundError(`No such billing portal configuration: ${id}`);
  }

  async getConfiguration(
    id: string,
    livemode: boolean,
  ): Promise<BillingPortalConfigurationResponse> {
    const configuration = await this.getConfigurationEntity(id, livemode);

    return BillingPortalService.buildConfiguration(configuration);
  }

  async findConfigurations(
    query: FindBillingPortalConfigurationsQuery,
    livemode: boolean,
  ): Promise<ListResponse<BillingPortalConfigurationResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows =
      await this.fastify.billingPortalConfigurationRepository.findBillingPortalConfigurations(
        { livemode, beforeAt, afterAt },
        limit + 1,
      );

    return {
      object: 'list',
      url: '/v1/billing_portal/configurations',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(BillingPortalService.buildConfiguration).value(),
    };
  }

  async createSession(
    payload: CreateBillingPortalSessionPayload,
    livemode: boolean,
  ): Promise<BillingPortalSessionResponse> {
    const customer = await this.fastify.customerService.getCustomer(payload.customerId, livemode);
    const configuration = await this.resolveConfiguration(payload.configurationId, livemode);
    const portalSession = await this.fastify.portalSessionService.createCustomerPortalSession(
      customer.id,
      livemode,
    );
    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.BILLING_PORTAL_SESSION);
    const session = await this.fastify.billingPortalSessionRepository.createBillingPortalSession({
      id,
      livemode,
      customerId: customer.id,
      configurationId: configuration.id,
      portalSessionId: portalSession.portalSessionId,
      url: portalSession.url,
      returnUrl: payload.returnUrl ?? configuration.defaultReturnUrl,
      expiresAt: portalSession.sessionExpiresAt,
      createdAt: now,
    });

    if (session) {
      return BillingPortalService.buildSession(session);
    }

    throw new NotFoundError(`Billing portal session ${id} could not be created`);
  }

  async getSession(id: string, livemode: boolean): Promise<BillingPortalSessionResponse> {
    const session = await this.fastify.billingPortalSessionRepository.findBillingPortalSession(id);

    if (session && session.livemode === livemode) {
      return BillingPortalService.buildSession(session);
    }

    throw new NotFoundError(`No such billing portal session: ${id}`);
  }

  async getActiveConfiguration(livemode: boolean): Promise<BillingPortalConfigurationResponse> {
    const configuration = await this.resolveConfiguration(undefined, livemode);

    return BillingPortalService.buildConfiguration(configuration);
  }

  private async resolveConfiguration(
    id: string | undefined,
    livemode: boolean,
  ): Promise<BillingPortalConfiguration> {
    if (id) {
      return this.getConfigurationEntity(id, livemode);
    }

    const [existing] =
      await this.fastify.billingPortalConfigurationRepository.findBillingPortalConfigurations(
        { livemode, isDefault: true, isActive: true },
        1,
      );

    if (existing) {
      return existing;
    }

    const fallbackConfiguration = await this.createConfiguration({ isDefault: true }, livemode);

    return this.getConfigurationEntity(fallbackConfiguration.id, livemode);
  }

  private async getConfigurationEntity(
    id: string,
    livemode: boolean,
  ): Promise<BillingPortalConfiguration> {
    const configuration =
      await this.fastify.billingPortalConfigurationRepository.findBillingPortalConfiguration(id);

    if (configuration && configuration.livemode === livemode) {
      return configuration;
    }

    throw new NotFoundError(`No such billing portal configuration: ${id}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const configuration =
        await this.fastify.billingPortalConfigurationRepository.findBillingPortalConfiguration(id);

      if (configuration) {
        return { createdAt: configuration.createdAt, id: configuration.id };
      }

      throw new NotFoundError(`No such billing portal configuration: ${id}`);
    }

    return undefined;
  }

  private static buildConfiguration(
    entity: BillingPortalConfiguration,
  ): BillingPortalConfigurationResponse {
    return {
      object: 'billing_portal.configuration',
      id: entity.id,
      livemode: entity.livemode,
      isActive: entity.isActive,
      isDefault: entity.isDefault,
      businessName: entity.businessName,
      defaultReturnUrl: entity.defaultReturnUrl,
      features: entity.features,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private static buildSession(entity: BillingPortalSession): BillingPortalSessionResponse {
    return {
      object: 'billing_portal.session',
      id: entity.id,
      livemode: entity.livemode,
      customerId: entity.customerId,
      configurationId: entity.configurationId,
      portalSessionId: entity.portalSessionId,
      url: entity.url,
      returnUrl: entity.returnUrl,
      expiresAt: entity.expiresAt.toISOString(),
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
