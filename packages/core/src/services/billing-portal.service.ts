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
import type { BillingPortalConfiguration } from '@database/schemas';
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
  ): Promise<BillingPortalConfigurationResponse> {
    const createdAt = this.fastify.clock.now().toISOString();

    const isDefault = payload.isDefault ?? false;

    const id = generateGid(ObjectPrefixEnum.BILLING_PORTAL_CONFIGURATION);

    const configuration = await this.fastify.database.master.transaction(async (tx) => {
      if (isDefault) {
        await this.fastify.billingPortalConfigurationRepository.demoteBillingPortalConfigurations(
          tx,
        );
      }

      return this.fastify.billingPortalConfigurationRepository.createBillingPortalConfiguration(
        {
          id,
          isActive: true,
          isDefault,
          businessName: payload.businessName ?? DEFAULT_BUSINESS_NAME,
          defaultReturnUrl: payload.defaultReturnUrl ?? null,
          features: { ...DEFAULT_FEATURES, ...payload.features },
          metadata: payload.metadata ?? {},
          createdAt: createdAt,
          updatedAt: createdAt,
        },
        tx,
      );
    });

    if (configuration) {
      return configuration;
    }

    throw new NotFoundError(`Billing portal configuration ${id} could not be created`);
  }

  async updateConfiguration(
    id: string,
    payload: UpdateBillingPortalConfigurationPayload,
  ): Promise<BillingPortalConfigurationResponse> {
    const configuration = await this.getConfigurationEntity(id);
    const updatedAt = this.fastify.clock.now().toISOString();

    const updatedConfiguration = await this.fastify.database.master.transaction(async (tx) => {
      if (payload.isDefault) {
        await this.fastify.billingPortalConfigurationRepository.demoteBillingPortalConfigurations(
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
          updatedAt,
        },
        tx,
      );
    });

    if (updatedConfiguration) {
      return updatedConfiguration;
    }

    throw new NotFoundError(`No such billing portal configuration: ${id}`);
  }

  async getConfiguration(id: string): Promise<BillingPortalConfigurationResponse> {
    return this.getConfigurationEntity(id);
  }

  async findConfigurations(
    query: FindBillingPortalConfigurationsQuery,
  ): Promise<ListResponse<BillingPortalConfigurationResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows =
      await this.fastify.billingPortalConfigurationRepository.findBillingPortalConfigurations(
        { beforeAt, afterAt },
        limit + 1,
      );

    return {
      url: '/v1/billing_portal/configurations',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  async createSession(
    payload: CreateBillingPortalSessionPayload,
  ): Promise<BillingPortalSessionResponse> {
    const customer = await this.fastify.customerService.getCustomer(payload.customerId);
    const configuration = await this.resolveConfiguration(payload.configurationId);
    const portalSession = await this.fastify.portalSessionService.createCustomerPortalSession(
      customer.id,
    );
    const createdAt = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.BILLING_PORTAL_SESSION);
    const session = await this.fastify.billingPortalSessionRepository.createBillingPortalSession({
      id,
      customerId: customer.id,
      configurationId: configuration.id,
      portalSessionId: portalSession.portalSessionId,
      url: portalSession.url,
      returnUrl: payload.returnUrl ?? configuration.defaultReturnUrl,
      expiresAt: portalSession.sessionExpiresAt,
      createdAt,
    });

    if (session) {
      return session;
    }

    throw new NotFoundError(`Billing portal session ${id} could not be created`);
  }

  async getSession(id: string): Promise<BillingPortalSessionResponse> {
    const session = await this.fastify.billingPortalSessionRepository.findBillingPortalSession(id);

    if (session) {
      return session;
    }

    throw new NotFoundError(`No such billing portal session: ${id}`);
  }

  async getActiveConfiguration(): Promise<BillingPortalConfigurationResponse> {
    return this.resolveConfiguration(undefined);
  }

  private async resolveConfiguration(id: string | undefined): Promise<BillingPortalConfiguration> {
    if (id) {
      return this.getConfigurationEntity(id);
    }

    const [existing] =
      await this.fastify.billingPortalConfigurationRepository.findBillingPortalConfigurations(
        { isDefault: true, isActive: true },
        1,
      );

    if (existing) {
      return existing;
    }

    const fallbackConfiguration = await this.createConfiguration({ isDefault: true });

    return this.getConfigurationEntity(fallbackConfiguration.id);
  }

  private async getConfigurationEntity(id: string): Promise<BillingPortalConfiguration> {
    const configuration =
      await this.fastify.billingPortalConfigurationRepository.findBillingPortalConfiguration(id);

    if (configuration) {
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
}
