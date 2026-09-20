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
import type { PaymentMethod } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class PaymentMethodService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPaymentMethod(payload: CreatePaymentMethodPayload): Promise<PaymentMethodResponse> {
    const customer = payload.customerId
      ? await this.fastify.customerRepository.getCustomer(payload.customerId)
      : null;

    const tokenized = await this.fastify.psp.tokenize({
      token: payload.token,
      type: payload.type,
    });

    const createdAt = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.PAYMENT_METHOD);
    const customerId = _.get(customer, 'id', null);

    const { billingDetails = {}, metadata = {} } = payload;

    const createdPaymentMethod = await this.fastify.paymentMethodRepository.createPaymentMethod({
      id,
      customerId,
      type: payload.type,
      card: tokenized.card,
      billingDetails,
      pspToken: payload.token,
      metadata,
      createdAt,
      updatedAt: createdAt,
    });

    if (createdPaymentMethod) {
      return createdPaymentMethod;
    }

    throw new NotFoundError(`Payment method ${id} could not be created`);
  }

  async attachPaymentMethod(
    id: string,
    payload: AttachPaymentMethodPayload,
  ): Promise<PaymentMethodResponse> {
    const paymentMethod = await this.fastify.paymentMethodRepository.getPaymentMethod(id);
    const customer = await this.fastify.customerRepository.getCustomer(payload.customerId);

    if (paymentMethod.customerId && paymentMethod.customerId !== customer.id) {
      throw new ConflictError(
        `Payment method ${id} is already attached to customer ${paymentMethod.customerId}`,
      );
    }

    if (paymentMethod.detachedAt) {
      throw new ConflictError(`Payment method ${id} has been detached and cannot be reattached`);
    }

    const updatedAt = this.fastify.clock.now().toISOString();

    const attachedPaymentMethod = await this.fastify.database.master.transaction(async (tx) => {
      const updatedPaymentMethod = await this.fastify.paymentMethodRepository.updatePaymentMethod(
        paymentMethod.id,
        { customerId: customer.id, updatedAt },
        tx,
      );

      if (payload.shouldBeDefault) {
        await this.fastify.customerRepository.updateCustomer(
          customer.id,
          { defaultPaymentMethodId: paymentMethod.id, updatedAt },
          tx,
        );
      }

      return updatedPaymentMethod;
    });

    if (attachedPaymentMethod) {
      return attachedPaymentMethod;
    }

    throw new NotFoundError(`No such payment method: ${id}`);
  }

  async detachPaymentMethod(id: string): Promise<PaymentMethodResponse> {
    const paymentMethod = await this.fastify.paymentMethodRepository.getPaymentMethod(id);

    if (paymentMethod.detachedAt) {
      throw new ConflictError(`Payment method ${id} is already detached`);
    }

    const detachedAt = this.fastify.clock.now().toISOString();

    const { customerId } = paymentMethod;

    const detachedPaymentMethod = await this.fastify.database.master.transaction(async (tx) => {
      if (customerId) {
        await this.clearDefaults(customerId, paymentMethod.id, detachedAt, tx);
      }

      return this.fastify.paymentMethodRepository.updatePaymentMethod(
        paymentMethod.id,
        { customerId: null, detachedAt, updatedAt: detachedAt },
        tx,
      );
    });

    if (detachedPaymentMethod) {
      return detachedPaymentMethod;
    }

    throw new NotFoundError(`No such payment method: ${id}`);
  }

  async updatePaymentMethod(
    id: string,
    payload: UpdatePaymentMethodPayload,
  ): Promise<PaymentMethodResponse> {
    const paymentMethod = await this.fastify.paymentMethodRepository.getPaymentMethod(id);

    const { card } = paymentMethod;

    if (payload.card && !card) {
      throw new BadRequestError(`Payment method ${id} has no card details to update`, {
        param: 'card',
      });
    }

    const updatedCard = payload.card && card ? { ...card, ...payload.card } : card;
    const billingDetails = { ...paymentMethod.billingDetails, ...payload.billingDetails };
    const metadata = { ...paymentMethod.metadata, ...payload.metadata };

    const updatedPaymentMethod = await this.fastify.paymentMethodRepository.updatePaymentMethod(
      paymentMethod.id,
      {
        card: updatedCard,
        billingDetails,
        metadata,
        updatedAt: this.fastify.clock.now().toISOString(),
      },
    );

    if (updatedPaymentMethod) {
      return updatedPaymentMethod;
    }

    throw new NotFoundError(`No such payment method: ${id}`);
  }

  async getPaymentMethod(id: string): Promise<PaymentMethodResponse> {
    return this.fastify.paymentMethodRepository.getPaymentMethod(id);
  }

  async findPaymentMethods(
    query: FindPaymentMethodsQuery,
  ): Promise<ListResponse<PaymentMethodResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.paymentMethodRepository.findPaymentMethods(
      {
        customerId: query.customerId,
        type: query.type,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      url: '/v1/payment_methods',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  async getChargeablePaymentMethod(id: string): Promise<PaymentMethod> {
    const paymentMethod = await this.fastify.paymentMethodRepository.getPaymentMethod(id);

    if (paymentMethod.detachedAt) {
      throw new ConflictError(`Payment method ${id} has been detached and cannot be charged`);
    }

    return paymentMethod;
  }

  private async clearDefaults(
    customerId: string,
    paymentMethodId: string,
    detachedAt: string,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const customer = await this.fastify.customerRepository.findCustomer(customerId);

    if (_.get(customer, 'defaultPaymentMethodId') === paymentMethodId) {
      await this.fastify.customerRepository.updateCustomer(
        customerId,
        { defaultPaymentMethodId: null, updatedAt: detachedAt },
        tx,
      );
    }

    await this.fastify.subscriptionRepository.clearSubscriptionPaymentMethods(
      paymentMethodId,
      detachedAt,
      tx,
    );
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const paymentMethod = await this.fastify.paymentMethodRepository.getPaymentMethod(id);

      return { createdAt: paymentMethod.createdAt, id: paymentMethod.id };
    }

    return undefined;
  }
}
