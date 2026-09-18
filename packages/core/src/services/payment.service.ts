import { PspIntentStatusEnum } from '@clients/mock-psp.client';
import { DisputeOutcomeEnum } from '@contracts/disputes.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CancelPaymentIntentPayload,
  CapturePaymentIntentPayload,
  ConfirmPaymentIntentPayload,
  CreatePaymentIntentPayload,
  DeclineCode,
  FailureCode,
  FindPaymentIntentsQuery,
  PaymentIntentResponse,
  PaymentIntentStatus,
  PspCallbackPayload,
  PspCallbackResponse,
  PspProvider,
} from '@contracts/payments.types';
import {
  CaptureMethodEnum,
  ChargeOutcomeEnum,
  ChargeStatusEnum,
  PAYMENT_INTENT_TRANSITIONS,
  PaymentCancellationReasonEnum,
  PaymentIntentStatusEnum,
  PspEventTypeEnum,
  PspProviderEnum,
} from '@contracts/payments.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Charge, Customer, Invoice, PaymentIntent, PaymentMethod } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import type { Currency } from '@utils/currency';
import { mapPspDeclineCode } from '@utils/decline-code';
import { mapPspDisputeReason } from '@utils/dispute-reason';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

interface PaymentIntentTarget {
  invoice: Invoice | null;
  customerId: string;
  currency: Currency;
  amount: number;
}

export class PaymentService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPaymentIntent(payload: CreatePaymentIntentPayload): Promise<PaymentIntentResponse> {
    const target = await this.resolveTarget(payload);
    const paymentMethodId = await this.resolveRequestedPaymentMethodId(payload);
    const createdAt = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.PAYMENT_INTENT);

    const createdPaymentIntent = await this.fastify.paymentIntentRepository.createPaymentIntent({
      id,
      invoiceId: _.get(target.invoice, 'id', null),
      customerId: target.customerId,
      status: paymentMethodId
        ? PaymentIntentStatusEnum.REQUIRES_CONFIRMATION
        : PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
      currency: target.currency,
      amount: target.amount,
      amountCapturable: 0,
      amountReceived: 0,
      captureMethod: payload.captureMethod ?? CaptureMethodEnum.AUTOMATIC,
      paymentMethodId,
      latestChargeId: null,
      nextAction: null,
      cancellationReason: null,
      pspReference: null,
      failureCode: null,
      declineCode: null,
      failureMessage: null,
      metadata: payload.metadata ?? {},
      createdAt,
      updatedAt: createdAt,
    });

    if (createdPaymentIntent) {
      return this.buildPaymentIntent(createdPaymentIntent);
    }

    throw new NotFoundError(`Payment intent ${id} could not be created`);
  }

  async confirmPaymentIntent(
    id: string,
    payload: ConfirmPaymentIntentPayload,
  ): Promise<PaymentIntentResponse> {
    const paymentIntent = await this.getPaymentIntentEntity(id);

    PaymentService.assertTransition(paymentIntent.status, PaymentIntentStatusEnum.PROCESSING);

    const paymentMethod = await this.resolvePaymentMethod(paymentIntent, payload);
    const previousCharges = await this.fastify.paymentIntentRepository.findCharges({
      paymentIntentIds: [paymentIntent.id],
    });
    const confirmation = await this.fastify.psp.confirmPayment({
      token: paymentMethod.pspToken,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      captureMethod: paymentIntent.captureMethod,
      idempotencyKey: `charge:${paymentIntent.id}:${previousCharges.length}`,
    });
    const isAwaitingAction = confirmation.status === PspIntentStatusEnum.REQUIRES_ACTION;

    const confirmedPaymentIntent = await this.fastify.paymentIntentRepository.updatePaymentIntent(
      paymentIntent.id,
      {
        status: isAwaitingAction
          ? PaymentIntentStatusEnum.REQUIRES_ACTION
          : PaymentIntentStatusEnum.PROCESSING,
        paymentMethodId: paymentMethod.id,
        nextAction: confirmation.nextAction,
        pspReference: confirmation.reference,
        failureCode: null,
        declineCode: null,
        failureMessage: null,
        metadata: { ...paymentIntent.metadata, ...(payload.metadata ?? {}) },
        updatedAt: this.fastify.clock.now().toISOString(),
      },
    );

    if (confirmedPaymentIntent) {
      return this.buildPaymentIntent(confirmedPaymentIntent);
    }

    throw new NotFoundError(`No such payment intent: ${id}`);
  }

  async capturePaymentIntent(
    id: string,
    payload: CapturePaymentIntentPayload,
  ): Promise<PaymentIntentResponse> {
    const paymentIntent = await this.getPaymentIntentEntity(id);

    if (paymentIntent.status !== PaymentIntentStatusEnum.REQUIRES_CAPTURE) {
      throw new ConflictError(
        `Payment intent ${id} is ${paymentIntent.status} and has nothing authorized to capture`,
      );
    }

    const amount = payload.amount ?? paymentIntent.amountCapturable;

    if (amount > paymentIntent.amountCapturable) {
      throw new BadRequestError(
        `A capture of ${amount} exceeds the ${paymentIntent.amountCapturable} authorized on payment intent ${id}`,
        { param: 'amount' },
      );
    }

    const { pspReference } = paymentIntent;

    if (!pspReference) {
      throw new ConflictError(
        `Payment intent ${id} has no processor reference and cannot be captured`,
      );
    }

    await this.fastify.psp.capturePayment({
      reference: pspReference,
      amount,
      idempotencyKey: `capture:${paymentIntent.id}:${amount}`,
    });

    const capturingPaymentIntent = await this.fastify.paymentIntentRepository.updatePaymentIntent(
      paymentIntent.id,
      {
        status: PaymentIntentStatusEnum.PROCESSING,
        metadata: { ...paymentIntent.metadata, ...(payload.metadata ?? {}) },
        updatedAt: this.fastify.clock.now().toISOString(),
      },
    );

    if (capturingPaymentIntent) {
      return this.buildPaymentIntent(capturingPaymentIntent);
    }

    throw new NotFoundError(`No such payment intent: ${id}`);
  }

  async cancelPaymentIntent(
    id: string,
    payload: CancelPaymentIntentPayload,
  ): Promise<PaymentIntentResponse> {
    const paymentIntent = await this.getPaymentIntentEntity(id);

    PaymentService.assertTransition(paymentIntent.status, PaymentIntentStatusEnum.CANCELED);

    const canceledPaymentIntent = await this.fastify.paymentIntentRepository.updatePaymentIntent(
      paymentIntent.id,
      {
        status: PaymentIntentStatusEnum.CANCELED,
        cancellationReason:
          payload.cancellationReason ?? PaymentCancellationReasonEnum.REQUESTED_BY_CUSTOMER,
        nextAction: null,
        amountCapturable: 0,
        metadata: { ...paymentIntent.metadata, ...(payload.metadata ?? {}) },
        updatedAt: this.fastify.clock.now().toISOString(),
      },
    );

    if (canceledPaymentIntent) {
      return this.buildPaymentIntent(canceledPaymentIntent);
    }

    throw new NotFoundError(`No such payment intent: ${paymentIntent.id}`);
  }

  async getPaymentIntent(id: string): Promise<PaymentIntentResponse> {
    const paymentIntent = await this.getPaymentIntentEntity(id);

    return this.buildPaymentIntent(paymentIntent);
  }

  async findPaymentIntents(
    query: FindPaymentIntentsQuery,
  ): Promise<ListResponse<PaymentIntentResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.paymentIntentRepository.findPaymentIntents(
      {
        invoiceId: query.invoiceId,
        customerId: query.customerId,
        status: query.status,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );
    const page = _.take(rows, limit);
    const chargesByIntentId = await this.resolveCharges(_.map(page, 'id'));

    return {
      url: '/v1/payment_intents',
      hasMore: rows.length > limit,
      data: _.map(page, (paymentIntent) => {
        const intentCharges = _.get(chargesByIntentId, paymentIntent.id, []);

        return PaymentService.buildPaymentIntentWithCharges(paymentIntent, intentCharges);
      }),
    };
  }

  async handleProviderEvent(
    provider: PspProvider,
    payload: PspCallbackPayload,
  ): Promise<PspCallbackResponse> {
    const recorded = await this.fastify.pspEventRepository.createPspEvent({
      id: generateGid(ObjectPrefixEnum.PSP_EVENT),
      provider,
      eventId: payload.id,
      type: payload.type,
      payload: { ...payload },
      receivedAt: this.fastify.clock.now().toISOString(),
    });

    if (!recorded) {
      this.fastify.log.info(
        { provider, eventId: payload.id },
        '[PaymentService] handleProviderEvent() skipped, this event was already applied',
      );

      return { provider, eventId: payload.id, isDuplicate: true };
    }

    await this.applyProviderEvent(payload);

    return { provider, eventId: payload.id, isDuplicate: false };
  }

  async drainProviderEvents(): Promise<number> {
    const pending = this.fastify.psp.takePendingEvents();

    for (const event of pending) {
      await this.handleProviderEvent(PspProviderEnum.MOCK, event);
    }

    return pending.length;
  }

  private async applyProviderEvent(payload: PspCallbackPayload): Promise<void> {
    if (payload.type === PspEventTypeEnum.SETUP_SUCCEEDED) {
      await this.fastify.setupIntentService.handleSetupSucceeded(payload.reference);

      return;
    }

    if (payload.type === PspEventTypeEnum.SETUP_FAILED) {
      await this.fastify.setupIntentService.handleSetupFailed(payload.reference, {
        failureCode: payload.failureCode ?? null,
        failureMessage: payload.failureMessage ?? null,
      });

      return;
    }

    if (payload.type === PspEventTypeEnum.REFUND_SUCCEEDED) {
      await this.fastify.refundService.handleRefundSucceeded(payload.reference);

      return;
    }

    if (payload.type === PspEventTypeEnum.REFUND_FAILED) {
      await this.fastify.refundService.handleRefundFailed(
        payload.reference,
        payload.failureMessage ?? null,
      );

      return;
    }

    if (payload.type === PspEventTypeEnum.DISPUTE_CREATED) {
      await this.applyDisputeOpened(payload);

      return;
    }

    if (payload.type === PspEventTypeEnum.DISPUTE_CLOSED) {
      await this.fastify.disputeService.handleDisputeClosed(
        payload.reference,
        payload.outcome === DisputeOutcomeEnum.WON
          ? DisputeOutcomeEnum.WON
          : DisputeOutcomeEnum.LOST,
      );

      return;
    }

    if (payload.type === PspEventTypeEnum.PAYOUT_PAID) {
      await this.fastify.payoutService.handlePayoutPaid(payload.reference);

      return;
    }

    if (payload.type === PspEventTypeEnum.PAYOUT_FAILED) {
      await this.fastify.payoutService.handlePayoutFailed(payload.reference, {
        failureCode: payload.reason ?? null,
        failureMessage: payload.failureMessage ?? null,
      });

      return;
    }

    if (payload.type === PspEventTypeEnum.PAYMENT_FAILED) {
      await this.applyPaymentFailure(payload);

      return;
    }

    await this.applyPaymentSuccess(payload);
  }

  private async applyDisputeOpened(payload: PspCallbackPayload): Promise<void> {
    const { sourceReference, amount } = payload;

    if (!sourceReference || !amount) {
      throw new BadRequestError(
        `Dispute callback ${payload.id} arrived without a charge reference and an amount`,
      );
    }

    await this.fastify.disputeService.handleDisputeOpened({
      pspReference: payload.reference,
      chargeReference: sourceReference,
      amount,
      reason: mapPspDisputeReason(payload.reason ?? null),
    });
  }

  private async applyPaymentSuccess(payload: PspCallbackPayload): Promise<void> {
    const paymentIntent = await this.getCallbackPaymentIntent(payload.reference);
    const isAuthorizationOnly = payload.type === PspEventTypeEnum.PAYMENT_AUTHORIZED;
    const amount = payload.amount ?? paymentIntent.amount;
    const now = this.fastify.clock.now();
    const chargedAt = now.toISOString();

    const settled = await this.fastify.database.master.transaction(async (tx) => {
      const locked = await this.getLockedPaymentIntent(paymentIntent.id, tx);

      if (locked.status === PaymentIntentStatusEnum.SUCCEEDED) {
        return null;
      }

      const charge = await this.recordCharge(
        locked,
        {
          amount,
          amountCaptured: isAuthorizationOnly ? 0 : amount,
          captured: !isAuthorizationOnly,
          status: isAuthorizationOnly ? ChargeStatusEnum.PENDING : ChargeStatusEnum.SUCCEEDED,
          outcome: isAuthorizationOnly ? ChargeOutcomeEnum.AUTHORIZED : ChargeOutcomeEnum.APPROVED,
          paymentMethodDetails: payload.paymentMethodDetails ?? {},
          failureCode: null,
          declineCode: null,
          failureMessage: null,
          createdAt: chargedAt,
        },
        tx,
      );

      const updatedPaymentIntent = await this.fastify.paymentIntentRepository.updatePaymentIntent(
        locked.id,
        {
          status: isAuthorizationOnly
            ? PaymentIntentStatusEnum.REQUIRES_CAPTURE
            : PaymentIntentStatusEnum.SUCCEEDED,
          amountCapturable: isAuthorizationOnly ? amount : 0,
          amountReceived: isAuthorizationOnly ? 0 : amount,
          latestChargeId: charge.id,
          nextAction: null,
          failureCode: null,
          declineCode: null,
          failureMessage: null,
          updatedAt: chargedAt,
        },
        tx,
      );

      if (!updatedPaymentIntent) {
        throw new NotFoundError(`No such payment intent: ${locked.id}`);
      }

      if (isAuthorizationOnly) {
        return { paymentIntent: updatedPaymentIntent, charge };
      }

      const { invoiceId } = updatedPaymentIntent;

      await this.fastify.balanceService.recordChargeSettlement(charge, invoiceId, tx);

      if (invoiceId) {
        await this.fastify.invoiceService.applyInvoicePayment(
          invoiceId,
          {
            amount,
            paymentIntentId: updatedPaymentIntent.id,
            chargeId: charge.id,
            settlementReference: `payment_intent:${updatedPaymentIntent.id}`,
          },
          tx,
        );
      }

      await this.recordPaymentEvent(
        updatedPaymentIntent,
        DomainEventTypeEnum.PAYMENT_INTENT_SUCCEEDED,
        tx,
      );

      return { paymentIntent: updatedPaymentIntent, charge };
    });

    if (!settled) {
      this.fastify.log.info(
        { paymentIntentId: paymentIntent.id },
        '[PaymentService] applyPaymentSuccess() skipped, the intent had already succeeded',
      );

      return;
    }

    if (!isAuthorizationOnly) {
      await this.settleSubscription(settled.paymentIntent, now);
      await this.fastify.notificationService.dispatchPaymentSucceeded(settled.paymentIntent);
    }
  }

  private async applyPaymentFailure(payload: PspCallbackPayload): Promise<void> {
    const paymentIntent = await this.getCallbackPaymentIntent(payload.reference);
    const declineCode = mapPspDeclineCode(payload.declineCode ?? null);
    const now = this.fastify.clock.now();
    const failedAt = now.toISOString();

    const failed = await this.fastify.database.master.transaction(async (tx) => {
      const locked = await this.getLockedPaymentIntent(paymentIntent.id, tx);

      if (locked.status === PaymentIntentStatusEnum.SUCCEEDED) {
        return null;
      }

      const charge = await this.recordCharge(
        locked,
        {
          amount: locked.amount,
          amountCaptured: 0,
          captured: false,
          status: ChargeStatusEnum.FAILED,
          outcome: ChargeOutcomeEnum.DECLINED,
          paymentMethodDetails: payload.paymentMethodDetails ?? {},
          failureCode: payload.failureCode ?? null,
          declineCode,
          failureMessage: payload.failureMessage ?? null,
          createdAt: failedAt,
        },
        tx,
      );

      const updatedPaymentIntent = await this.fastify.paymentIntentRepository.updatePaymentIntent(
        locked.id,
        {
          status: PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
          nextAction: null,
          amountCapturable: 0,
          latestChargeId: charge.id,
          failureCode: payload.failureCode ?? null,
          declineCode,
          failureMessage: payload.failureMessage ?? null,
          updatedAt: failedAt,
        },
        tx,
      );

      if (!updatedPaymentIntent) {
        throw new NotFoundError(`No such payment intent: ${locked.id}`);
      }

      await this.recordPaymentEvent(
        updatedPaymentIntent,
        DomainEventTypeEnum.PAYMENT_INTENT_FAILED,
        tx,
      );

      return updatedPaymentIntent;
    });

    if (failed) {
      await this.fastify.dunningService.handlePaymentFailed(failed, declineCode, now);
    }
  }

  private async recordCharge(
    paymentIntent: PaymentIntent,
    payload: {
      amount: number;
      amountCaptured: number;
      captured: boolean;
      status: ChargeStatusEnum;
      outcome: ChargeOutcomeEnum;
      paymentMethodDetails: Record<string, unknown>;
      failureCode: FailureCode | null;
      declineCode: DeclineCode | null;
      failureMessage: string | null;
      createdAt: string;
    },
    tx: DatabaseTransaction,
  ): Promise<Charge> {
    const id = generateGid(ObjectPrefixEnum.CHARGE);
    const charge = await this.fastify.paymentIntentRepository.createCharge(
      {
        id,
        paymentIntentId: paymentIntent.id,
        customerId: paymentIntent.customerId,
        paymentMethodId: paymentIntent.paymentMethodId,
        currency: paymentIntent.currency,
        amount: payload.amount,
        amountCaptured: payload.amountCaptured,
        amountRefunded: 0,
        captured: payload.captured,
        status: payload.status,
        outcome: payload.outcome,
        balanceTransactionId: null,
        paymentMethodDetails: payload.paymentMethodDetails,
        failureCode: payload.failureCode,
        declineCode: payload.declineCode,
        failureMessage: payload.failureMessage,
        pspReference: paymentIntent.pspReference,
        metadata: {},
        createdAt: payload.createdAt,
        updatedAt: payload.createdAt,
      },
      tx,
    );

    if (charge) {
      return charge;
    }

    throw new NotFoundError(`Charge ${id} could not be created`);
  }

  private async settleSubscription(paymentIntent: PaymentIntent, now: Date): Promise<void> {
    const { invoiceId } = paymentIntent;

    if (!invoiceId) {
      return;
    }

    const invoice = await this.fastify.invoiceRepository.findInvoice(invoiceId);
    const subscriptionId = _.get(invoice, 'subscriptionId', null);

    if (invoice && subscriptionId) {
      const periodEnd = new Date(invoice.periodEnd);

      await this.fastify.subscriptionService.handleInvoicePaymentSucceeded(
        subscriptionId,
        now,
        periodEnd,
      );
    }
  }

  private async resolveTarget(payload: CreatePaymentIntentPayload): Promise<PaymentIntentTarget> {
    const { invoiceId } = payload;

    if (invoiceId) {
      return this.resolveInvoiceTarget(invoiceId, payload);
    }

    const { customerId, amount, currency } = payload;

    if (!customerId) {
      throw new BadRequestError(
        'A payment intent needs either an invoice or a customer to charge',
        { param: 'customerId' },
      );
    }

    if (!amount) {
      throw new BadRequestError('A standalone payment intent needs an amount', {
        param: 'amount',
      });
    }

    const customer = await this.getCustomer(customerId);

    return {
      invoice: null,
      customerId: customer.id,
      currency: currency ?? customer.currency,
      amount,
    };
  }

  private async resolveInvoiceTarget(
    invoiceId: string,
    payload: CreatePaymentIntentPayload,
  ): Promise<PaymentIntentTarget> {
    const invoice = await this.getInvoice(invoiceId);

    if (invoice.status !== InvoiceStatusEnum.OPEN) {
      throw new ConflictError(
        `Invoice ${invoice.id} is ${invoice.status} and cannot take a payment; only an open invoice can`,
      );
    }

    const owed = await this.resolveOwed(invoice);

    if (owed <= 0) {
      throw new ConflictError(`Invoice ${invoice.id} has nothing left to pay`);
    }

    const amount = payload.amount ?? owed;

    if (amount > owed) {
      throw new BadRequestError(
        `A payment intent of ${amount} exceeds the ${owed} still owed on invoice ${invoice.id}`,
        { param: 'amount' },
      );
    }

    return {
      invoice,
      customerId: invoice.customerId,
      currency: invoice.currency,
      amount,
    };
  }

  private async resolveOwed(invoice: Invoice): Promise<number> {
    const invoiceResponse = await this.fastify.invoiceService.getInvoice(invoice.id);

    return invoiceResponse.amountRemaining;
  }

  private async recordPaymentEvent(
    paymentIntent: PaymentIntent,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.PAYMENT_INTENT,
          aggregateId: paymentIntent.id,
          eventType,
          payload: {
            id: paymentIntent.id,
            invoiceId: paymentIntent.invoiceId,
            amount: paymentIntent.amount,
            status: paymentIntent.status,
          },
        },
      ],
      tx,
    );
  }

  private async getCustomer(id: string): Promise<Customer> {
    const customer = await this.fastify.customerRepository.findCustomer(id);

    if (customer) {
      return customer;
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  private async getInvoice(id: string): Promise<Invoice> {
    const invoice = await this.fastify.invoiceRepository.findInvoice(id);

    if (invoice) {
      return invoice;
    }

    throw new NotFoundError(`No such invoice: ${id}`);
  }

  private async getPaymentIntentEntity(id: string): Promise<PaymentIntent> {
    const paymentIntent = await this.fastify.paymentIntentRepository.findPaymentIntent(id);

    if (paymentIntent) {
      return paymentIntent;
    }

    throw new NotFoundError(`No such payment intent: ${id}`);
  }

  private async getCallbackPaymentIntent(pspReference: string): Promise<PaymentIntent> {
    const [paymentIntent] = await this.fastify.paymentIntentRepository.findPaymentIntents(
      { pspReference },
      1,
    );

    if (paymentIntent) {
      return paymentIntent;
    }

    throw new NotFoundError(`No payment intent for processor reference ${pspReference}`);
  }

  private async getLockedPaymentIntent(
    id: string,
    tx: DatabaseTransaction,
  ): Promise<PaymentIntent> {
    const paymentIntent = await this.fastify.paymentIntentRepository.findLockedPaymentIntent(
      id,
      tx,
    );

    if (paymentIntent) {
      return paymentIntent;
    }

    throw new NotFoundError(`No such payment intent: ${id}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const paymentIntent = await this.getPaymentIntentEntity(id);

      return { createdAt: paymentIntent.createdAt, id: paymentIntent.id };
    }

    return undefined;
  }

  private async resolveCharges(
    paymentIntentIds: readonly string[],
  ): Promise<Record<string, Charge[]>> {
    const rows = await this.fastify.paymentIntentRepository.findCharges({ paymentIntentIds });

    return _.groupBy(rows, 'paymentIntentId');
  }

  private async buildPaymentIntent(paymentIntent: PaymentIntent): Promise<PaymentIntentResponse> {
    const intentCharges = await this.fastify.paymentIntentRepository.findCharges({
      paymentIntentIds: [paymentIntent.id],
    });

    return PaymentService.buildPaymentIntentWithCharges(paymentIntent, intentCharges);
  }

  private async resolveRequestedPaymentMethodId(
    payload: CreatePaymentIntentPayload,
  ): Promise<string | null> {
    const { paymentMethodId } = payload;

    if (paymentMethodId) {
      const paymentMethod =
        await this.fastify.paymentMethodService.getChargeablePaymentMethod(paymentMethodId);

      return paymentMethod.id;
    }

    return null;
  }

  private async resolvePaymentMethod(
    paymentIntent: PaymentIntent,
    payload: ConfirmPaymentIntentPayload,
  ): Promise<PaymentMethod> {
    const requested = payload.paymentMethodId ?? paymentIntent.paymentMethodId;

    if (requested) {
      return this.fastify.paymentMethodService.getChargeablePaymentMethod(requested);
    }

    const customer = await this.fastify.customerRepository.findCustomer(paymentIntent.customerId);
    const defaultPaymentMethodId = _.get(customer, 'defaultPaymentMethodId', null);

    if (defaultPaymentMethodId) {
      return this.fastify.paymentMethodService.getChargeablePaymentMethod(defaultPaymentMethodId);
    }

    throw new BadRequestError(
      `Payment intent ${paymentIntent.id} has no payment method to charge`,
      { param: 'paymentMethodId' },
    );
  }

  private static assertTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): void {
    if (_.includes(PAYMENT_INTENT_TRANSITIONS[from], to)) {
      return;
    }

    throw new ConflictError(`A payment intent cannot move from ${from} to ${to}`);
  }

  private static buildPaymentIntentWithCharges(
    paymentIntent: PaymentIntent,
    charges: Charge[],
  ): PaymentIntentResponse {
    return { ...paymentIntent, charges };
  }
}
