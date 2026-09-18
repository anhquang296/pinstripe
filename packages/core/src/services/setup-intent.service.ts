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
import type { Customer, SetupIntent } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class SetupIntentService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createSetupIntent(
    payload: CreateSetupIntentPayload,
    livemode: boolean,
  ): Promise<SetupIntentResponse> {
    const customer = await this.getCustomer(payload.customerId, livemode);
    const paymentMethodId = await this.resolveRequestedPaymentMethodId(payload, livemode);
    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.SETUP_INTENT);

    const createdSetupIntent = await this.fastify.setupIntentRepository.createSetupIntent({
      id,
      livemode,
      customerId: customer.id,
      status: paymentMethodId
        ? SetupIntentStatusEnum.REQUIRES_CONFIRMATION
        : SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
      usage: payload.usage ?? SetupIntentUsageEnum.OFF_SESSION,
      paymentMethodId,
      nextAction: null,
      cancellationReason: null,
      pspReference: null,
      failureCode: null,
      failureMessage: null,
      metadata: payload.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });

    if (createdSetupIntent) {
      return SetupIntentService.buildSetupIntent(createdSetupIntent);
    }

    throw new NotFoundError(`Setup intent ${id} could not be created`);
  }

  async confirmSetupIntent(
    id: string,
    payload: ConfirmSetupIntentPayload,
    livemode: boolean,
  ): Promise<SetupIntentResponse> {
    const setupIntent = await this.getSetupIntentEntity(id, livemode);
    const paymentMethodId = payload.paymentMethodId ?? setupIntent.paymentMethodId;

    if (!paymentMethodId) {
      throw new BadRequestError(`Setup intent ${id} has no payment method to save`, {
        param: 'paymentMethodId',
      });
    }

    const paymentMethod = await this.fastify.paymentMethodService.getChargeablePaymentMethod(
      paymentMethodId,
      livemode,
    );

    SetupIntentService.assertTransition(setupIntent.status, SetupIntentStatusEnum.PROCESSING);

    const confirmation = await this.fastify.psp.confirmSetup({
      token: paymentMethod.pspToken,
      idempotencyKey: `setup:${setupIntent.id}`,
    });
    const now = this.fastify.clock.now();
    const isAwaitingAction = confirmation.status === PspIntentStatusEnum.REQUIRES_ACTION;

    const confirmedSetupIntent = await this.fastify.setupIntentRepository.updateSetupIntent(
      setupIntent.id,
      {
        status: isAwaitingAction
          ? SetupIntentStatusEnum.REQUIRES_ACTION
          : SetupIntentStatusEnum.PROCESSING,
        paymentMethodId: paymentMethod.id,
        nextAction: confirmation.nextAction,
        pspReference: confirmation.reference,
        failureCode: null,
        failureMessage: null,
        metadata: { ...setupIntent.metadata, ...(payload.metadata ?? {}) },
        updatedAt: now,
      },
    );

    if (confirmedSetupIntent) {
      return SetupIntentService.buildSetupIntent(confirmedSetupIntent);
    }

    throw new NotFoundError(`No such setup intent: ${id}`);
  }

  async cancelSetupIntent(
    id: string,
    payload: CancelSetupIntentPayload,
    livemode: boolean,
  ): Promise<SetupIntentResponse> {
    const setupIntent = await this.getSetupIntentEntity(id, livemode);

    SetupIntentService.assertTransition(setupIntent.status, SetupIntentStatusEnum.CANCELED);

    const now = this.fastify.clock.now();
    const canceledSetupIntent = await this.fastify.setupIntentRepository.updateSetupIntent(
      setupIntent.id,
      {
        status: SetupIntentStatusEnum.CANCELED,
        cancellationReason:
          payload.cancellationReason ?? PaymentCancellationReasonEnum.REQUESTED_BY_CUSTOMER,
        nextAction: null,
        metadata: { ...setupIntent.metadata, ...(payload.metadata ?? {}) },
        updatedAt: now,
      },
    );

    if (canceledSetupIntent) {
      return SetupIntentService.buildSetupIntent(canceledSetupIntent);
    }

    throw new NotFoundError(`No such setup intent: ${id}`);
  }

  async getSetupIntent(id: string, livemode: boolean): Promise<SetupIntentResponse> {
    const setupIntent = await this.getSetupIntentEntity(id, livemode);

    return SetupIntentService.buildSetupIntent(setupIntent);
  }

  async findSetupIntents(
    query: FindSetupIntentsQuery,
    livemode: boolean,
  ): Promise<ListResponse<SetupIntentResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter, livemode);
    const afterAt = await this.resolveCursor(query.endingBefore, livemode);
    const rows = await this.fastify.setupIntentRepository.findSetupIntents(
      { livemode, customerId: query.customerId, status: query.status, beforeAt, afterAt },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/setup_intents',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(SetupIntentService.buildSetupIntent).value(),
    };
  }

  async handleSetupSucceeded(pspReference: string): Promise<void> {
    const setupIntent = await this.getCallbackSetupIntent(pspReference);

    if (setupIntent.status === SetupIntentStatusEnum.SUCCEEDED) {
      return;
    }

    const now = this.fastify.clock.now();
    const { paymentMethodId } = setupIntent;

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.setupIntentRepository.updateSetupIntent(
        setupIntent.id,
        {
          status: SetupIntentStatusEnum.SUCCEEDED,
          nextAction: null,
          failureCode: null,
          failureMessage: null,
          updatedAt: now,
        },
        tx,
      );

      if (paymentMethodId) {
        await this.fastify.paymentMethodRepository.updatePaymentMethod(
          paymentMethodId,
          { customerId: setupIntent.customerId, updatedAt: now },
          tx,
        );
        await this.fastify.customerRepository.updateCustomer(
          setupIntent.customerId,
          { defaultPaymentMethodId: paymentMethodId, updatedAt: now },
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
    const now = this.fastify.clock.now();

    await this.fastify.setupIntentRepository.updateSetupIntent(setupIntent.id, {
      status: SetupIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
      nextAction: null,
      failureCode: failure.failureCode,
      failureMessage: failure.failureMessage,
      updatedAt: now,
    });

    this.fastify.log.warn(
      { setupIntentId: setupIntent.id, failureCode: failure.failureCode },
      '[SetupIntentService] handleSetupFailed() the card could not be saved',
    );
  }

  private async resolveRequestedPaymentMethodId(
    payload: CreateSetupIntentPayload,
    livemode: boolean,
  ): Promise<string | null> {
    const { paymentMethodId } = payload;

    if (paymentMethodId) {
      const paymentMethod = await this.fastify.paymentMethodService.getChargeablePaymentMethod(
        paymentMethodId,
        livemode,
      );

      return paymentMethod.id;
    }

    return null;
  }

  private async getCustomer(id: string, livemode: boolean): Promise<Customer> {
    const customer = await this.fastify.customerRepository.findCustomer(id);

    if (customer && customer.livemode === livemode) {
      return customer;
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  private async getSetupIntentEntity(id: string, livemode: boolean): Promise<SetupIntent> {
    const setupIntent = await this.fastify.setupIntentRepository.findSetupIntent(id);

    if (setupIntent && setupIntent.livemode === livemode) {
      return setupIntent;
    }

    throw new NotFoundError(`No such setup intent: ${id}`);
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

  private async resolveCursor(
    id: string | undefined,
    livemode: boolean,
  ): Promise<RowCursor | undefined> {
    if (id) {
      const setupIntent = await this.getSetupIntentEntity(id, livemode);

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

  private static buildSetupIntent(entity: SetupIntent): SetupIntentResponse {
    return {
      object: 'setup_intent',
      id: entity.id,
      customerId: entity.customerId,
      status: entity.status,
      usage: entity.usage,
      paymentMethodId: entity.paymentMethodId,
      nextAction: entity.nextAction,
      cancellationReason: entity.cancellationReason,
      pspReference: entity.pspReference,
      failureCode: entity.failureCode,
      failureMessage: entity.failureMessage,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
