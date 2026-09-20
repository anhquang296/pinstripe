import type { CustomerResponse } from '@contracts/customers.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateTaxIdPayload,
  DeletedTaxIdResponse,
  FindTaxIdsQuery,
  TaxIdResponse,
  TaxIdType,
  TaxIdVerificationStatus,
} from '@contracts/taxes.types';
import { TaxIdTypeEnum, TaxIdVerificationStatusEnum } from '@contracts/taxes.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { TaxId } from '@database/schemas';
import { ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import { QueueNameEnum } from '@queues/queue-name';
import type { TaxIdVerifyJob } from '@queues/tax.queue';
import { buildTaxIdVerifyJob, TAX_ID_VERIFY_JOB } from '@queues/tax.queue';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const TAX_ID_PATTERNS: Record<TaxIdType, RegExp> = {
  [TaxIdTypeEnum.VN_TIN]: /^\d{10}(-\d{3})?$/,
  [TaxIdTypeEnum.EU_VAT]: /^[A-Z]{2}[0-9A-Z]{8,12}$/,
  [TaxIdTypeEnum.US_EIN]: /^\d{2}-\d{7}$/,
  [TaxIdTypeEnum.OTHER]: /^.{1,64}$/,
};

export class TaxIdService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createTaxId(payload: CreateTaxIdPayload): Promise<TaxIdResponse> {
    const customer = await this.fastify.customerService.getCustomer(payload.customerId);
    const now = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.TAX_ID);

    const createdTaxId = await this.writeTaxId(id, payload, customer.id, now);

    await this.dispatchTaxIdVerification(createdTaxId.id);

    return TaxIdService.buildTaxId(createdTaxId);
  }

  private async writeTaxId(
    id: string,
    payload: CreateTaxIdPayload,
    customerId: string,
    now: string,
  ): Promise<TaxId> {
    const { metadata = {} } = payload;

    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const taxId = await this.fastify.taxIdRepository.createTaxId(
          {
            id,
            customerId,
            type: payload.type,
            value: payload.value,
            country: payload.country ?? null,
            verificationStatus: TaxIdVerificationStatusEnum.PENDING,
            verifiedName: null,
            verifiedAddress: null,
            verificationAttemptedAt: null,
            metadata,
            createdAt: now,
            updatedAt: now,
          },
          tx,
        );

        if (taxId) {
          await this.recordTaxIdEvent(taxId, DomainEventTypeEnum.TAX_ID_CREATED, tx);

          return taxId;
        }

        throw new NotFoundError(`Tax id ${id} could not be created`);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          `Customer ${customerId} already carries the ${payload.type} tax id ${payload.value}`,
          { param: 'value', cause: error },
        );
      }

      throw error;
    }
  }

  private async dispatchTaxIdVerification(taxIdId: string): Promise<Job<TaxIdVerifyJob>> {
    return this.fastify.queues
      .resolve(QueueNameEnum.TAX)
      .add(TAX_ID_VERIFY_JOB, buildTaxIdVerifyJob(taxIdId), {
        jobId: `tax-id-verify-${taxIdId}`,
        removeOnComplete: true,
      });
  }

  async verifyTaxId(taxIdId: string): Promise<TaxIdResponse> {
    const taxId = await this.fastify.taxIdRepository.getTaxId(taxIdId);
    const customer = await this.fastify.customerService.getCustomer(taxId.customerId);
    const now = this.fastify.clock.now().toISOString();
    const status = TaxIdService.resolveVerificationStatus(taxId);
    const isVerified = status === TaxIdVerificationStatusEnum.VERIFIED;
    const verifiedName = isVerified ? customer.name : null;
    const verifiedAddress = isVerified ? TaxIdService.formatAddress(customer.address) : null;

    const verifiedTaxId = await this.fastify.database.master.transaction(async (tx) => {
      const updatedTaxId = await this.fastify.taxIdRepository.updateTaxId(
        taxIdId,
        {
          verificationStatus: status,
          verifiedName,
          verifiedAddress,
          verificationAttemptedAt: now,
          updatedAt: now,
        },
        tx,
      );

      if (updatedTaxId) {
        await this.recordTaxIdEvent(updatedTaxId, DomainEventTypeEnum.TAX_ID_UPDATED, tx);

        return updatedTaxId;
      }

      throw new NotFoundError(`No such tax id: ${taxIdId}`);
    });

    return TaxIdService.buildTaxId(verifiedTaxId);
  }

  private static resolveVerificationStatus(taxId: TaxId): TaxIdVerificationStatus {
    const pattern = TAX_ID_PATTERNS[taxId.type];

    if (pattern.test(taxId.value)) {
      return TaxIdVerificationStatusEnum.VERIFIED;
    }

    return TaxIdVerificationStatusEnum.UNVERIFIED;
  }

  private static formatAddress(address: CustomerResponse['address']): string | null {
    const parts = _.compact([
      _.get(address, 'line1', ''),
      _.get(address, 'city', ''),
      _.get(address, 'state', ''),
      _.get(address, 'country', ''),
    ]);

    if (_.isEmpty(parts)) {
      return null;
    }

    return parts.join(', ');
  }

  async getTaxId(id: string): Promise<TaxIdResponse> {
    const taxId = await this.fastify.taxIdRepository.getTaxId(id);

    return TaxIdService.buildTaxId(taxId);
  }

  async deleteTaxId(id: string): Promise<DeletedTaxIdResponse> {
    const taxId = await this.fastify.taxIdRepository.getTaxId(id);
    const deletedAt = this.fastify.clock.now().toISOString();

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.taxIdRepository.archiveTaxId(id, deletedAt, tx);
      await this.recordTaxIdEvent(taxId, DomainEventTypeEnum.TAX_ID_DELETED, tx);
    });

    return { id, deleted: true };
  }

  async findTaxIds(query: FindTaxIdsQuery): Promise<ListResponse<TaxIdResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.taxIdRepository.findTaxIds(
      { customerId: query.customerId, beforeAt, afterAt },
      limit + 1,
    );

    return {
      url: '/v1/tax_ids',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(TaxIdService.buildTaxId).value(),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const taxId = await this.fastify.taxIdRepository.getTaxId(id);

      return { createdAt: taxId.createdAt, id: taxId.id };
    }

    return undefined;
  }

  private async recordTaxIdEvent(
    taxId: TaxId,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.TAX_ID,
          aggregateId: taxId.id,
          eventType,
          payload: {
            id: taxId.id,
            customerId: taxId.customerId,
            type: taxId.type,
            verificationStatus: taxId.verificationStatus,
          },
        },
      ],
      tx,
    );
  }

  static buildTaxId(entity: TaxId): TaxIdResponse {
    return {
      id: entity.id,
      customerId: entity.customerId,
      type: entity.type,
      value: entity.value,
      country: entity.country,
      verification: {
        status: entity.verificationStatus,
        verifiedName: entity.verifiedName,
        verifiedAddress: entity.verifiedAddress,
        attemptedAt: entity.verificationAttemptedAt,
      },
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
