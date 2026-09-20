import type {
  CheckoutSessionResponse,
  CheckoutSessionStatus,
  CompleteCheckoutSessionPayload,
  CreateCheckoutSessionPayload,
  FindCheckoutSessionsQuery,
} from '@contracts/checkout.types';
import {
  CHECKOUT_SESSION_TRANSITIONS,
  CheckoutPaymentStatusEnum,
  CheckoutSessionModeEnum,
  CheckoutSessionStatusEnum,
} from '@contracts/checkout.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import { PaymentMethodTypeEnum } from '@contracts/payment-methods.types';
import type { DatabaseTransaction } from '@database/database.client';
import type {
  CheckoutSession,
  CheckoutSessionLineItem,
  Customer,
  NewCheckoutSessionLineItem,
  Price,
} from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { HostedResourceEnum } from '@utils/hosted-url';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const MILLISECONDS_PER_MINUTE = 60_000;
const EXPIRE_BATCH_LIMIT = 200;
const DEFAULT_QUANTITY = 1;

export interface CheckoutConfig {
  sessionTtlMinutes: number;
}

export interface CheckoutLineItemDraft {
  priceId: string;
  quantity: number;
}

export class CheckoutService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly checkoutConfig: CheckoutConfig,
  ) {}

  async createCheckoutSession(
    payload: CreateCheckoutSessionPayload,
  ): Promise<CheckoutSessionResponse> {
    const customer = await this.fastify.customerRepository.getCustomer(payload.customerId);
    const drafts = CheckoutService.readLineItemDrafts(payload.lineItems);

    CheckoutService.assertLineItems(payload.mode, drafts);

    const prices = await this.resolvePrices(drafts, customer);
    const now = this.fastify.clock.now();
    const createdAt = now.toISOString();
    const id = generateGid(ObjectPrefixEnum.CHECKOUT_SESSION);
    const lineItems = CheckoutService.buildLineItems(id, drafts, prices, createdAt);
    const amountTotal = _.sumBy(lineItems, 'amountTotal');

    const { metadata = {} } = payload;

    const paymentStatus =
      payload.mode === CheckoutSessionModeEnum.SETUP
        ? CheckoutPaymentStatusEnum.NO_PAYMENT_REQUIRED
        : CheckoutPaymentStatusEnum.UNPAID;

    const createdSession = await this.fastify.database.master.transaction(async (tx) => {
      const checkoutSession = await this.fastify.checkoutSessionRepository.createCheckoutSession(
        {
          id,
          mode: payload.mode,
          status: CheckoutSessionStatusEnum.OPEN,
          paymentStatus,
          customerId: customer.id,
          currency: customer.currency,
          amountSubtotal: amountTotal,
          amountTotal,
          successUrl: payload.successUrl,
          cancelUrl: payload.cancelUrl ?? null,
          url: this.fastify.hostedUrlFactory.buildCheckoutUrl(id),
          clientReferenceId: payload.clientReferenceId ?? null,
          paymentLinkId: null,
          subscriptionId: null,
          invoiceId: null,
          paymentIntentId: null,
          setupIntentId: null,
          expiresAt: this.resolveExpiry(payload.expiresAt, now),
          completedAt: null,
          metadata,
          createdAt,
          updatedAt: createdAt,
        },
        tx,
      );

      if (!checkoutSession) {
        throw new NotFoundError(`Checkout session ${id} could not be created`);
      }

      await this.fastify.checkoutSessionRepository.createCheckoutSessionLineItems(lineItems, tx);

      return checkoutSession;
    });

    return this.buildCheckoutSession(createdSession);
  }

  async createPaymentLinkCheckoutSession(
    paymentLinkId: string,
    customerId: string,
  ): Promise<CheckoutSessionResponse> {
    const paymentLink = await this.fastify.paymentLinkRepository.getPaymentLink(paymentLinkId);

    if (!paymentLink.isActive) {
      throw new ConflictError(`Payment link ${paymentLinkId} is no longer active`);
    }

    const linkLineItems = await this.fastify.paymentLinkRepository.findPaymentLinkLineItems([
      paymentLink.id,
    ]);

    const session = await this.createCheckoutSession({
      mode: paymentLink.mode,
      customerId,
      successUrl: paymentLink.successUrl,
      lineItems: _.map(linkLineItems, (lineItem) => {
        return { priceId: lineItem.priceId, quantity: lineItem.quantity };
      }),
    });

    const linkedSession = await this.fastify.checkoutSessionRepository.updateCheckoutSession(
      session.id,
      { paymentLinkId: paymentLink.id, updatedAt: this.fastify.clock.now().toISOString() },
    );

    if (linkedSession) {
      return this.buildCheckoutSession(linkedSession);
    }

    throw new NotFoundError(`No such checkout session: ${session.id}`);
  }

  async getCheckoutSession(id: string): Promise<CheckoutSessionResponse> {
    const checkoutSession = await this.fastify.checkoutSessionRepository.getCheckoutSession(id);

    return this.buildCheckoutSession(checkoutSession);
  }

  async getHostedCheckoutSession(id: string, token: string): Promise<CheckoutSessionResponse> {
    const checkoutSession = await this.getVerifiedCheckoutSession(id, token);

    return this.buildCheckoutSession(checkoutSession);
  }

  async findCheckoutSessions(
    query: FindCheckoutSessionsQuery,
  ): Promise<ListResponse<CheckoutSessionResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.checkoutSessionRepository.findCheckoutSessions(
      { customerId: query.customerId, status: query.status, beforeAt, afterAt },
      limit + 1,
    );

    const page = _.take(rows, limit);
    const lineItemsBySessionId = await this.resolveLineItems(_.map(page, 'id'));

    return {
      url: '/v1/checkout/sessions',
      hasMore: rows.length > limit,
      data: _.map(page, (checkoutSession) => {
        return CheckoutService.buildCheckoutSessionWithLineItems(
          checkoutSession,
          _.get(lineItemsBySessionId, checkoutSession.id, []),
        );
      }),
    };
  }

  async completeCheckoutSession(
    id: string,
    payload: CompleteCheckoutSessionPayload,
    token: string,
  ): Promise<CheckoutSessionResponse> {
    const checkoutSession = await this.getVerifiedCheckoutSession(id, token);

    CheckoutService.assertTransition(checkoutSession.status, CheckoutSessionStatusEnum.COMPLETE);

    const now = this.fastify.clock.now();
    const expiresAt = new Date(checkoutSession.expiresAt);

    if (expiresAt.getTime() <= now.getTime()) {
      throw new ConflictError(`Checkout session ${id} has expired`);
    }

    const paymentMethodId = await this.resolvePaymentMethodId(checkoutSession, payload);
    const outcome = await this.runCheckoutMode(checkoutSession, paymentMethodId);
    const completedAt = this.fastify.clock.now().toISOString();

    const completedSession = await this.fastify.database.master.transaction(async (tx) => {
      const completed = await this.fastify.checkoutSessionRepository.updateCheckoutSession(
        checkoutSession.id,
        {
          status: CheckoutSessionStatusEnum.COMPLETE,
          paymentStatus: outcome.paymentStatus,
          subscriptionId: outcome.subscriptionId,
          invoiceId: outcome.invoiceId,
          paymentIntentId: outcome.paymentIntentId,
          setupIntentId: outcome.setupIntentId,
          completedAt,
          updatedAt: completedAt,
        },
        tx,
      );

      if (!completed) {
        throw new NotFoundError(`No such checkout session: ${checkoutSession.id}`);
      }

      await this.recordCheckoutEvent(completed, DomainEventTypeEnum.CHECKOUT_SESSION_COMPLETED, tx);

      return completed;
    });

    this.fastify.log.info(
      { checkoutSessionId: completedSession.id, mode: completedSession.mode },
      '[CheckoutService] completeCheckoutSession() success',
    );

    return this.buildCheckoutSession(completedSession);
  }

  async expireCheckoutSessions(): Promise<number> {
    const stale = await this.fastify.checkoutSessionRepository.findCheckoutSessions(
      {
        status: CheckoutSessionStatusEnum.OPEN,
        expiresBeforeAt: this.fastify.clock.now().toISOString(),
      },
      EXPIRE_BATCH_LIMIT,
    );

    for (const checkoutSession of stale) {
      await this.expireCheckoutSession(checkoutSession);
    }

    if (stale.length > 0) {
      this.fastify.log.info(
        { expired: stale.length },
        '[CheckoutService] expireCheckoutSessions() closed the sessions that ran out of time',
      );
    }

    return stale.length;
  }

  private async expireCheckoutSession(checkoutSession: CheckoutSession): Promise<void> {
    const updatedAt = this.fastify.clock.now().toISOString();

    await this.fastify.database.master.transaction(async (tx) => {
      const expired = await this.fastify.checkoutSessionRepository.updateCheckoutSession(
        checkoutSession.id,
        { status: CheckoutSessionStatusEnum.EXPIRED, updatedAt },
        tx,
      );

      if (!expired) {
        throw new NotFoundError(`No such checkout session: ${checkoutSession.id}`);
      }

      await this.recordCheckoutEvent(expired, DomainEventTypeEnum.CHECKOUT_SESSION_EXPIRED, tx);
    });
  }

  private async runCheckoutMode(
    checkoutSession: CheckoutSession,
    paymentMethodId: string,
  ): Promise<CheckoutOutcome> {
    if (checkoutSession.mode === CheckoutSessionModeEnum.SETUP) {
      return this.runSetupMode(checkoutSession, paymentMethodId);
    }

    if (checkoutSession.mode === CheckoutSessionModeEnum.SUBSCRIPTION) {
      return this.runSubscriptionMode(checkoutSession);
    }

    return this.runPaymentMode(checkoutSession, paymentMethodId);
  }

  private async runSetupMode(
    checkoutSession: CheckoutSession,
    paymentMethodId: string,
  ): Promise<CheckoutOutcome> {
    const setupIntent = await this.fastify.setupIntentService.createSetupIntent({
      customerId: checkoutSession.customerId,
      paymentMethodId,
    });

    await this.fastify.setupIntentService.confirmSetupIntent(setupIntent.id, { paymentMethodId });

    return {
      paymentStatus: CheckoutPaymentStatusEnum.NO_PAYMENT_REQUIRED,
      subscriptionId: null,
      invoiceId: null,
      paymentIntentId: null,
      setupIntentId: setupIntent.id,
    };
  }

  private async runSubscriptionMode(checkoutSession: CheckoutSession): Promise<CheckoutOutcome> {
    const lineItems = await this.fastify.checkoutSessionRepository.findCheckoutSessionLineItems([
      checkoutSession.id,
    ]);

    const subscription = await this.fastify.subscriptionService.createSubscription({
      customerId: checkoutSession.customerId,
      items: _.map(lineItems, (lineItem) => {
        return { priceId: lineItem.priceId, quantity: lineItem.quantity };
      }),
    });

    const [invoice] = await this.fastify.invoiceRepository.findInvoices(
      { subscriptionId: subscription.id },
      1,
    );

    return {
      paymentStatus: CheckoutPaymentStatusEnum.PAID,
      subscriptionId: subscription.id,
      invoiceId: _.get(invoice, 'id', null),
      paymentIntentId: null,
      setupIntentId: null,
    };
  }

  private async runPaymentMode(
    checkoutSession: CheckoutSession,
    paymentMethodId: string,
  ): Promise<CheckoutOutcome> {
    const lineItems = await this.fastify.checkoutSessionRepository.findCheckoutSessionLineItems([
      checkoutSession.id,
    ]);

    for (const lineItem of lineItems) {
      await this.fastify.invoiceItemService.createInvoiceItem({
        customerId: checkoutSession.customerId,
        priceId: lineItem.priceId,
        quantity: lineItem.quantity,
      });
    }

    const draft = await this.fastify.invoiceService.createInvoice({
      customerId: checkoutSession.customerId,
      metadata: { checkoutSessionId: checkoutSession.id },
    });

    const invoice = await this.fastify.invoiceService.finalizeInvoice(draft.id);

    const paymentIntent = await this.fastify.paymentService.createPaymentIntent({
      invoiceId: invoice.id,
      paymentMethodId,
    });

    await this.fastify.paymentService.confirmPaymentIntent(paymentIntent.id, { paymentMethodId });

    return {
      paymentStatus: CheckoutPaymentStatusEnum.UNPAID,
      subscriptionId: null,
      invoiceId: invoice.id,
      paymentIntentId: paymentIntent.id,
      setupIntentId: null,
    };
  }

  private async resolvePaymentMethodId(
    checkoutSession: CheckoutSession,
    payload: CompleteCheckoutSessionPayload,
  ): Promise<string> {
    const { paymentMethodId, token } = payload;

    if (paymentMethodId) {
      return paymentMethodId;
    }

    if (token) {
      const paymentMethod = await this.fastify.paymentMethodService.createPaymentMethod({
        type: PaymentMethodTypeEnum.CARD,
        token,
        customerId: checkoutSession.customerId,
      });

      await this.fastify.paymentMethodService.attachPaymentMethod(paymentMethod.id, {
        customerId: checkoutSession.customerId,
        shouldBeDefault: true,
      });

      return paymentMethod.id;
    }

    const customer = await this.fastify.customerRepository.getCustomer(checkoutSession.customerId);

    const { defaultPaymentMethodId } = customer;

    if (defaultPaymentMethodId) {
      return defaultPaymentMethodId;
    }

    throw new BadRequestError('This checkout session needs a card before it can complete', {
      param: 'token',
    });
  }

  private async recordCheckoutEvent(
    checkoutSession: CheckoutSession,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.CHECKOUT_SESSION,
          aggregateId: checkoutSession.id,
          eventType,
          payload: {
            id: checkoutSession.id,
            mode: checkoutSession.mode,
            status: checkoutSession.status,
            customerId: checkoutSession.customerId,
            amountTotal: checkoutSession.amountTotal,
            currency: checkoutSession.currency,
          },
        },
      ],
      tx,
    );
  }

  private async getVerifiedCheckoutSession(id: string, token: string): Promise<CheckoutSession> {
    const isVerified = this.fastify.hostedUrlFactory.verifyToken(
      HostedResourceEnum.CHECKOUT_SESSION,
      id,
      token,
    );

    const checkoutSession = await this.fastify.checkoutSessionRepository.findCheckoutSession(id);

    if (isVerified && checkoutSession) {
      return checkoutSession;
    }

    throw new NotFoundError(`No such checkout session: ${id}`);
  }

  private async resolvePrices(
    drafts: readonly CheckoutLineItemDraft[],
    customer: Customer,
  ): Promise<Record<string, Price>> {
    const priceIds = _.uniq(_.map(drafts, 'priceId'));

    if (priceIds.length === 0) {
      return {};
    }

    const prices = await this.fastify.priceRepository.findPrices(
      { ids: priceIds },
      priceIds.length,
    );

    const pricesById = _.keyBy(prices, 'id');

    for (const priceId of priceIds) {
      const price = _.get(pricesById, priceId);

      if (!price) {
        throw new NotFoundError(`No such price: ${priceId}`);
      }

      if (price.currency !== customer.currency) {
        throw new BadRequestError(
          `Price ${priceId} is in ${price.currency} but the customer bills in ${customer.currency}`,
          { param: 'lineItems' },
        );
      }
    }

    return pricesById;
  }

  private async resolveLineItems(
    checkoutSessionIds: readonly string[],
  ): Promise<Record<string, CheckoutSessionLineItem[]>> {
    const rows =
      await this.fastify.checkoutSessionRepository.findCheckoutSessionLineItems(checkoutSessionIds);

    return _.groupBy(rows, 'checkoutSessionId');
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const checkoutSession = await this.fastify.checkoutSessionRepository.getCheckoutSession(id);

      return { createdAt: checkoutSession.createdAt, id: checkoutSession.id };
    }

    return undefined;
  }

  private resolveExpiry(expiresAt: string | undefined, now: Date): string {
    if (expiresAt) {
      return new Date(expiresAt).toISOString();
    }

    return new Date(
      now.getTime() + this.checkoutConfig.sessionTtlMinutes * MILLISECONDS_PER_MINUTE,
    ).toISOString();
  }

  private async buildCheckoutSession(
    checkoutSession: CheckoutSession,
  ): Promise<CheckoutSessionResponse> {
    const lineItems = await this.fastify.checkoutSessionRepository.findCheckoutSessionLineItems([
      checkoutSession.id,
    ]);

    return CheckoutService.buildCheckoutSessionWithLineItems(checkoutSession, lineItems);
  }

  private static readLineItemDrafts(
    lineItems: CreateCheckoutSessionPayload['lineItems'],
  ): CheckoutLineItemDraft[] {
    return _.map(lineItems, (lineItem): CheckoutLineItemDraft => {
      const { priceId, quantity = DEFAULT_QUANTITY } = lineItem;

      return { priceId, quantity };
    });
  }

  private static assertLineItems(
    mode: CreateCheckoutSessionPayload['mode'],
    drafts: readonly CheckoutLineItemDraft[],
  ): void {
    if (mode === CheckoutSessionModeEnum.SETUP) {
      if (drafts.length === 0) {
        return;
      }

      throw new BadRequestError('A setup checkout session carries no line items', {
        param: 'lineItems',
      });
    }

    if (drafts.length > 0) {
      return;
    }

    throw new BadRequestError(`A ${mode} checkout session needs at least one line item`, {
      param: 'lineItems',
    });
  }

  private static buildLineItems(
    checkoutSessionId: string,
    drafts: readonly CheckoutLineItemDraft[],
    pricesById: Record<string, Price>,
    createdAt: string,
  ): NewCheckoutSessionLineItem[] {
    return _.map(drafts, (draft): NewCheckoutSessionLineItem => {
      const price = _.get(pricesById, draft.priceId);
      const unitAmount = price ? price.unitAmount : null;

      if (!unitAmount) {
        throw new BadRequestError(
          `Price ${draft.priceId} has no unit amount, so checkout cannot price it`,
          { param: 'lineItems' },
        );
      }

      const amount = unitAmount * draft.quantity;

      return {
        id: generateGid(ObjectPrefixEnum.CHECKOUT_SESSION_LINE_ITEM),
        checkoutSessionId,
        priceId: draft.priceId,
        quantity: draft.quantity,
        amountSubtotal: amount,
        amountTotal: amount,
        createdAt,
      };
    });
  }

  private static assertTransition(from: CheckoutSessionStatus, to: CheckoutSessionStatus): void {
    if (_.includes(CHECKOUT_SESSION_TRANSITIONS[from], to)) {
      return;
    }

    throw new ConflictError(`A checkout session cannot move from ${from} to ${to}`);
  }

  private static buildCheckoutSessionWithLineItems(
    checkoutSession: CheckoutSession,
    lineItems: CheckoutSessionLineItem[],
  ): CheckoutSessionResponse {
    return { ...checkoutSession, lineItems };
  }
}

interface CheckoutOutcome {
  paymentStatus: CheckoutPaymentStatusEnum;
  subscriptionId: string | null;
  invoiceId: string | null;
  paymentIntentId: string | null;
  setupIntentId: string | null;
}
