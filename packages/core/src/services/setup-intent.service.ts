import { PspIntentStatusEnum } from '@clients/mock-psp.client';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { FailureCode } from '@contracts/payments.types';
import { PaymentCancellationReasonEnum } from '@contracts/payments.types';
import type {
  CancelSetupIntentPayload,
  ConfirmSetupIntentPayload,
  CreateSetupIntentPayload,
  FindSetupIntentsQuery,
  SetupIntentResponse,
  SetupIntentStatus,
} from '@contracts/setup-intents.types';
import {
  SETUP_INTENT_TRANSITIONS,
  SetupIntentStatusEnum,
  SetupIntentUsageEnum,
} from '@contracts/setup-intents.types';
import type { SetupIntent } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class SetupIntentService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createSetupIntent(payload: CreateSetupIntentPayload): Promise<SetupIntentResponse> {
    const customer = await this.fastify.customerRepository.getCustomer(payload.customerId);
    const paymentMethodId = await this.resolveRequestedPaymentMethodId(payload);
    const createdAt = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.SETUP_INTENT);

    const status = paymentMethodId
      ? SetupIntentStatusEnum.REQUIRES_CONFIRMATION
      : SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD;

    const { usage = SetupIntentUsageEnum.OFF_SESSION, metadata = {} } = payload;

    const createdSetupIntent = await this.fastify.setupIntentRepository.createSetupIntent({
      id,
      customerId: customer.id,
      status,
      usage,
      paymentMethodId,
      nextAction: null,
      cancellationReason: null,
      pspReference: null,
      failureCode: null,
      failureMessage: null,
      metadata,
      createdAt,
      updatedAt: createdAt,
    });

    if (createdSetupIntent) {
      return createdSetupIntent;
    }

    throw new NotFoundError(`Setup intent ${id} could not be created`);
  }

  async confirmSetupIntent(
    id: string,
    payload: ConfirmSetupIntentPayload,
  ): Promise<SetupIntentResponse> {
    const setupIntent = await this.fastify.setupIntentRepository.getSetupIntent(id);

    const { paymentMethodId = setupIntent.paymentMethodId } = payload;

    if (!paymentMethodId) {
      throw new BadRequestError(`Setup intent ${id} has no payment method to save`, {
        param: 'paymentMethodId',
      });
    }

    const paymentMethod =
      await this.fastify.paymentMethodService.getChargeablePaymentMethod(paymentMethodId);

    SetupIntentService.assertTransition(setupIntent.status, SetupIntentStatusEnum.PROCESSING);

    const confirmation = await this.fastify.psp.confirmSetup({
      token: paymentMethod.pspToken,
      idempotencyKey: `setup:${setupIntent.id}`,
    });

    const isAwaitingAction = confirmation.status === PspIntentStatusEnum.REQUIRES_ACTION;

    const status = isAwaitingAction
      ? SetupIntentStatusEnum.REQUIRES_ACTION
      : SetupIntentStatusEnum.PROCESSING;

    const metadata = { ...setupIntent.metadata, ...payload.metadata };

    const confirmedSetupIntent = await this.fastify.setupIntentRepository.updateSetupIntent(
      setupIntent.id,
      {
        status,
        paymentMethodId: paymentMethod.id,
        nextAction: confirmation.nextAction,
        pspReference: confirmation.reference,
        failureCode: null,
        failureMessage: null,
        metadata,
        updatedAt: this.fastify.clock.now().toISOString(),
      },
    );

    if (confirmedSetupIntent) {
      return confirmedSetupIntent;
    }

    throw new NotFoundError(`No such setup intent: ${id}`);
  }

  async cancelSetupIntent(
    id: string,
    payload: CancelSetupIntentPayload,
  ): Promise<SetupIntentResponse> {
    const setupIntent = await this.fastify.setupIntentRepository.getSetupIntent(id);

    SetupIntentService.assertTransition(setupIntent.status, SetupIntentStatusEnum.CANCELED);

    const { cancellationReason = PaymentCancellationReasonEnum.REQUESTED_BY_CUSTOMER } = payload;

    const metadata = { ...setupIntent.metadata, ...payload.metadata };

    const canceledSetupIntent = await this.fastify.setupIntentRepository.updateSetupIntent(
      setupIntent.id,
      {
        status: SetupIntentStatusEnum.CANCELED,
        cancellationReason,
        nextAction: null,
        metadata,
        updatedAt: this.fastify.clock.now().toISOString(),
      },
    );

    if (canceledSetupIntent) {
      return canceledSetupIntent;
    }

    throw new NotFoundError(`No such setup intent: ${id}`);
  }

  async getSetupIntent(id: string): Promise<SetupIntentResponse> {
    return this.fastify.setupIntentRepository.getSetupIntent(id);
  }

  async findSetupIntents(query: FindSetupIntentsQuery): Promise<ListResponse<SetupIntentResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.setupIntentRepository.findSetupIntents(
      { customerId: query.customerId, status: query.status, beforeAt, afterAt },
      limit + 1,
    );

    return {
      url: '/v1/setup_intents',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  async handleSetupSucceeded(pspReference: string): Promise<void> {
    const setupIntent = await this.getCallbackSetupIntent(pspReference);

    if (setupIntent.status === SetupIntentStatusEnum.SUCCEEDED) {
      return;
    }

    const updatedAt = this.fastify.clock.now().toISOString();

    const { paymentMethodId } = setupIntent;

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.setupIntentRepository.updateSetupIntent(
        setupIntent.id,
        {
          status: SetupIntentStatusEnum.SUCCEEDED,
          nextAction: null,
          failureCode: null,
          failureMessage: null,
          updatedAt,
        },
        tx,
      );

      if (paymentMethodId) {
        await this.fastify.paymentMethodRepository.updatePaymentMethod(
          paymentMethodId,
          { customerId: setupIntent.customerId, updatedAt },
          tx,
        );
        await this.fastify.customerRepository.updateCustomer(
          setupIntent.customerId,
          { defaultPaymentMethodId: paymentMethodId, updatedAt },
          tx,
        );
      }
    });

    this.fastify.log.info(
      { setupIntentId: setupIntent.id },
      '[SetupIntentService] handleSetupSucceeded() saved the payment method',
    );
  }

  async handleSetupFailed(
    pspReference: string,
    failure: { failureCode: FailureCode | null; failureMessage: string | null },
  ): Promise<void> {
    const setupIntent = await this.getCallbackSetupIntent(pspReference);

    await this.fastify.setupIntentRepository.updateSetupIntent(setupIntent.id, {
      status: SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
      nextAction: null,
      failureCode: failure.failureCode,
      failureMessage: failure.failureMessage,
      updatedAt: this.fastify.clock.now().toISOString(),
    });

    this.fastify.log.warn(
      { setupIntentId: setupIntent.id, failureCode: failure.failureCode },
      '[SetupIntentService] handleSetupFailed() the card could not be saved',
    );
  }

  private async resolveRequestedPaymentMethodId(
    payload: CreateSetupIntentPayload,
  ): Promise<string | null> {
    const { paymentMethodId } = payload;

    if (paymentMethodId) {
      const paymentMethod =
        await this.fastify.paymentMethodService.getChargeablePaymentMethod(paymentMethodId);

      return paymentMethod.id;
    }

    return null;
  }

  private async getCallbackSetupIntent(pspReference: string): Promise<SetupIntent> {
    const [setupIntent] = await this.fastify.setupIntentRepository.findSetupIntents(
      { pspReference },
      1,
    );

    if (setupIntent) {
      return setupIntent;
    }

    throw new NotFoundError(`No setup intent for processor reference ${pspReference}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const setupIntent = await this.fastify.setupIntentRepository.getSetupIntent(id);

      return { createdAt: setupIntent.createdAt, id: setupIntent.id };
    }

    return undefined;
  }

  private static assertTransition(from: SetupIntentStatus, to: SetupIntentStatus): void {
    if (_.includes(SETUP_INTENT_TRANSITIONS[from], to)) {
      return;
    }

    throw new ConflictError(`A setup intent cannot move from ${from} to ${to}`);
  }
}
