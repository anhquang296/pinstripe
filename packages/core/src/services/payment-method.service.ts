import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  AttachPaymentMethodPayload,
  CreatePaymentMethodPayload,
  FindPaymentMethodsQuery,
  PaymentMethodResponse,
  UpdatePaymentMethodPayload,
} from '@contracts/payment-methods.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Customer, PaymentMethod } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class PaymentMethodService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPaymentMethod(
    payload: CreatePaymentMethodPayload,
    livemode: boolean,
  ): Promise<PaymentMethodResponse> {
    const customer = payload.customerId
      ? await this.getCustomer(payload.customerId, livemode)
      : null;
    const tokenized = await this.fastify.psp.tokenize({
      token: payload.token,
      type: payload.type,
    });
    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.PAYMENT_METHOD);

    const createdPaymentMethod = await this.fastify.paymentMethodRepository.createPaymentMethod({
      id,
      livemode,
      customerId: _.get(customer, 'id', null),
      type: payload.type,
      card: tokenized.card,
      billingDetails: payload.billingDetails ?? {},
      pspToken: payload.token,
      metadata: payload.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });

    if (createdPaymentMethod) {
      return PaymentMethodService.buildPaymentMethod(createdPaymentMethod);
    }

    throw new NotFoundError(`Payment method ${id} could not be created`);
  }

  async attachPaymentMethod(
    id: string,
    payload: AttachPaymentMethodPayload,
    livemode: boolean,
  ): Promise<PaymentMethodResponse> {
    const paymentMethod = await this.getPaymentMethodEntity(id, livemode);
    const customer = await this.getCustomer(payload.customerId, livemode);

    if (paymentMethod.customerId && paymentMethod.customerId !== customer.id) {
      throw new ConflictError(
        `Payment method ${id} is already attached to customer ${paymentMethod.customerId}`,
      );
    }

    if (paymentMethod.detachedAt) {
      throw new ConflictError(`Payment method ${id} has been detached and cannot be reattached`);
    }

    const now = this.fastify.clock.now();

    const attachedPaymentMethod = await this.fastify.database.master.transaction(async (tx) => {
      const updatedPaymentMethod = await this.fastify.paymentMethodRepository.updatePaymentMethod(
        paymentMethod.id,
        { customerId: customer.id, updatedAt: now },
        tx,
      );

      if (payload.shouldBeDefault) {
        await this.fastify.customerRepository.updateCustomer(
          customer.id,
          { defaultPaymentMethodId: paymentMethod.id, updatedAt: now },
          tx,
        );
      }

      return updatedPaymentMethod;
    });

    if (attachedPaymentMethod) {
      return PaymentMethodService.buildPaymentMethod(attachedPaymentMethod);
    }

    throw new NotFoundError(`No such payment method: ${id}`);
  }

  async detachPaymentMethod(id: string, livemode: boolean): Promise<PaymentMethodResponse> {
    const paymentMethod = await this.getPaymentMethodEntity(id, livemode);

    if (paymentMethod.detachedAt) {
      throw new ConflictError(`Payment method ${id} is already detached`);
    }

    const now = this.fastify.clock.now();
    const { customerId } = paymentMethod;

    const detachedPaymentMethod = await this.fastify.database.master.transaction(async (tx) => {
      if (customerId) {
        await this.clearDefaults(customerId, paymentMethod.id, now, tx);
      }

      return this.fastify.paymentMethodRepository.updatePaymentMethod(
        paymentMethod.id,
        { customerId: null, detachedAt: now, updatedAt: now },
        tx,
      );
    });

    if (detachedPaymentMethod) {
      return PaymentMethodService.buildPaymentMethod(detachedPaymentMethod);
    }

    throw new NotFoundError(`No such payment method: ${id}`);
  }

  async updatePaymentMethod(
    id: string,
    payload: UpdatePaymentMethodPayload,
    livemode: boolean,
  ): Promise<PaymentMethodResponse> {
    const paymentMethod = await this.getPaymentMethodEntity(id, livemode);
    const { card } = paymentMethod;

    if (payload.card && !card) {
      throw new BadRequestError(`Payment method ${id} has no card details to update`, {
        param: 'card',
      });
    }

    const now = this.fastify.clock.now();
    const updatedPaymentMethod = await this.fastify.paymentMethodRepository.updatePaymentMethod(
      paymentMethod.id,
      {
        card: payload.card && card ? { ...card, ...payload.card } : card,
        billingDetails: payload.billingDetails
          ? { ...paymentMethod.billingDetails, ...payload.billingDetails }
          : paymentMethod.billingDetails,
        metadata: { ...paymentMethod.metadata, ...(payload.metadata ?? {}) },
        updatedAt: now,
      },
    );

    if (updatedPaymentMethod) {
      return PaymentMethodService.buildPaymentMethod(updatedPaymentMethod);
    }

    throw new NotFoundError(`No such payment method: ${id}`);
  }

  async getPaymentMethod(id: string, livemode: boolean): Promise<PaymentMethodResponse> {
    const paymentMethod = await this.getPaymentMethodEntity(id, livemode);

    return PaymentMethodService.buildPaymentMethod(paymentMethod);
  }

  async findPaymentMethods(
    query: FindPaymentMethodsQuery,
    livemode: boolean,
  ): Promise<ListResponse<PaymentMethodResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter, livemode);
    const afterAt = await this.resolveCursor(query.endingBefore, livemode);
    const rows = await this.fastify.paymentMethodRepository.findPaymentMethods(
      {
        livemode,
        customerId: query.customerId,
        type: query.type,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/payment_methods',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(PaymentMethodService.buildPaymentMethod).value(),
    };
  }

  async getChargeablePaymentMethod(id: string, livemode: boolean): Promise<PaymentMethod> {
    const paymentMethod = await this.getPaymentMethodEntity(id, livemode);

    if (paymentMethod.detachedAt) {
      throw new ConflictError(`Payment method ${id} has been detached and cannot be charged`);
    }

    return paymentMethod;
  }

  private async clearDefaults(
    customerId: string,
    paymentMethodId: string,
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const customer = await this.fastify.customerRepository.findCustomer(customerId);

    if (_.get(customer, 'defaultPaymentMethodId') === paymentMethodId) {
      await this.fastify.customerRepository.updateCustomer(
        customerId,
        { defaultPaymentMethodId: null, updatedAt: now },
        tx,
      );
    }

    await this.fastify.subscriptionRepository.clearSubscriptionPaymentMethods(
      paymentMethodId,
      now,
      tx,
    );
  }

  private async getCustomer(id: string, livemode: boolean): Promise<Customer> {
    const customer = await this.fastify.customerRepository.findCustomer(id);

    if (customer && customer.livemode === livemode) {
      return customer;
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  private async getPaymentMethodEntity(id: string, livemode: boolean): Promise<PaymentMethod> {
    const paymentMethod = await this.fastify.paymentMethodRepository.findPaymentMethod(id);

    if (paymentMethod && paymentMethod.livemode === livemode) {
      return paymentMethod;
    }

    throw new NotFoundError(`No such payment method: ${id}`);
  }

  private async resolveCursor(
    id: string | undefined,
    livemode: boolean,
  ): Promise<RowCursor | undefined> {
    if (id) {
      const paymentMethod = await this.getPaymentMethodEntity(id, livemode);

      return { createdAt: paymentMethod.createdAt, id: paymentMethod.id };
    }

    return undefined;
  }

  private static buildPaymentMethod(entity: PaymentMethod): PaymentMethodResponse {
    return {
      object: 'payment_method',
      id: entity.id,
      customerId: entity.customerId,
      type: entity.type,
      card: entity.card,
      billingDetails: entity.billingDetails,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      detachedAt: entity.detachedAt ? entity.detachedAt.toISOString() : null,
    };
  }
}
