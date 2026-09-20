import { AUTOMATIC_COLLECTION_METHODS } from '@constants/collection';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import { CustomerBalanceTransactionTypeEnum } from '@contracts/customers.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type {
  CreateInvoicePayload,
  FindInvoicesQuery,
  InvoiceResponse,
  InvoiceStatus,
  PayInvoicePayload,
  VoidInvoicePayload,
} from '@contracts/invoices.types';
import {
  BillingReasonEnum,
  CreditNoteStatusEnum,
  INVOICE_TRANSITIONS,
  InvoiceReminderKindEnum,
  InvoiceStatusEnum,
  NumberSequenceEnum,
} from '@contracts/invoices.types';
import type { LedgerAccountCode } from '@contracts/ledger.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import { RefundStatusEnum } from '@contracts/payments.types';
import type {
  FindPortalInvoicesQuery,
  FindPortalPaymentsQuery,
  PortalInvoiceComparisonResponse,
  PortalInvoiceRemindersResponse,
  PortalInvoiceTotalsResponse,
  PortalPaymentChannel,
  PortalPaymentResponse,
} from '@contracts/portal.types';
import { PortalPaymentChannelEnum } from '@contracts/portal.types';
import type { TaxBehavior } from '@contracts/prices.types';
import { TaxBehaviorEnum } from '@contracts/prices.types';
import type { RatedInvoiceResponse } from '@contracts/rating.types';
import type { PauseCollectionBehavior } from '@contracts/subscriptions.types';
import {
  BillingModeEnum,
  CollectionMethodEnum,
  PauseCollectionBehaviorEnum,
} from '@contracts/subscriptions.types';
import type { DatabaseTransaction } from '@database/database.client';
import type {
  Invoice,
  InvoiceLineDiscountAmount,
  InvoiceLineItem,
  InvoiceLineItemTaxAmount,
  InvoicePayment,
  NewInvoiceLineItem,
  NewInvoiceLineItemTaxAmount,
  Subscription,
} from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import type { InvoiceFilters } from '@repositories/invoice.repository';
import type { RatingPeriod } from '@services/rating.service';
import { advancePeriod } from '@utils/billing-period';
import { assertCollectionMethodUsable } from '@utils/collection-method';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { buildInvoicesCsv } from '@utils/invoice-csv';
import { buildInvoiceTotals } from '@utils/invoice-totals';
import type { LineItemType } from '@utils/rating';
import { LineItemTypeEnum } from '@utils/rating';
import type { SubscriptionInterval } from '@utils/subscription-price';
import type { LineTaxAmount } from '@utils/tax';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const INVOICE_NUMBER_PREFIX = 'INV';
const NUMBER_PAD_LENGTH = 6;
const CUSTOMER_VISIBLE_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatusEnum.OPEN,
  InvoiceStatusEnum.PAID,
  InvoiceStatusEnum.UNCOLLECTIBLE,
  InvoiceStatusEnum.VOID,
];

export interface EnsuredInvoice {
  invoice: Invoice;
  isCreated: boolean;
}

export interface InvoiceDraftLine {
  subscriptionItemId: string | null;
  subscriptionItemChangeId: string | null;
  invoiceItemId: string | null;
  priceId: string | null;
  type: LineItemType;
  description: string;
  quantity: number;
  unitAmount: number | null;
  amount: number;
  discountable: boolean;
  discountAmounts: InvoiceLineDiscountAmount[];
  taxAmounts: LineTaxAmount[];
  taxRateIds: string[];
  taxBehavior: TaxBehavior;
  periodStart: string;
  periodEnd: string;
  prorationFactor: number;
  isCredit: boolean;
}

export interface InvoiceTotals {
  subtotal: number;
  subtotalExcludingTax: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  total: number;
  startingBalance: number;
  endingBalance: number;
  amountDue: number;
}

export interface InvoiceServiceConfig {
  dueDays: number;
}

export interface ApplyInvoicePaymentPayload {
  amount?: number;
  paymentIntentId?: string;
  chargeId?: string;
  settlementReference?: string;
  clearingAccountCode?: LedgerAccountCode;
}

export class InvoiceService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly config: InvoiceServiceConfig,
  ) {}

  async createInvoice(payload: CreateInvoicePayload): Promise<InvoiceResponse> {
    const { subscriptionId, customerId, metadata = {} } = payload;

    if (subscriptionId) {
      const subscription =
        await this.fastify.subscriptionRepository.getSubscription(subscriptionId);
      const { invoice } = await this.ensureDraftInvoice(
        subscription,
        metadata,
        InvoiceService.readCurrentPeriod(subscription),
      );

      return this.buildInvoice(invoice);
    }

    if (customerId) {
      const invoice = await this.writeStandaloneInvoice(customerId, payload);

      return this.buildInvoice(invoice);
    }

    throw new BadRequestError('An invoice needs either a customer or a subscription', {
      param: 'customerId',
    });
  }

  private async writeStandaloneInvoice(
    customerId: string,
    payload: CreateInvoicePayload,
  ): Promise<Invoice> {
    const customer = await this.fastify.customerService.getCustomer(customerId);
    const now = await this.fastify.clockService.resolveCustomerNow(customerId);
    const createdAt = now.toISOString();
    const id = generateGid(ObjectPrefixEnum.INVOICE);

    const {
      collectionMethod = CollectionMethodEnum.CHARGE_AUTOMATICALLY,
      autoAdvance = true,
      daysUntilDue = null,
      currency = customer.currency,
      defaultTaxRates = [],
      metadata = {},
    } = payload;

    assertCollectionMethodUsable(collectionMethod, customer);

    return this.fastify.database.master.transaction(async (tx) => {
      const invoice = await this.fastify.invoiceRepository.createInvoice(
        {
          id,
          number: null,
          customerId,
          subscriptionId: null,
          status: InvoiceStatusEnum.DRAFT,
          billingReason: BillingReasonEnum.MANUAL,
          currency,
          collectionMethod,
          autoAdvance,
          daysUntilDue,
          periodStart: createdAt,
          periodEnd: createdAt,
          defaultTaxRates,
          automaticTaxEnabled: _.get(payload.automaticTax, 'enabled', false),
          metadata,
          createdAt,
          updatedAt: createdAt,
        },
        tx,
      );

      if (invoice) {
        await this.recordInvoiceEvent(invoice, DomainEventTypeEnum.INVOICE_CREATED, tx);

        return invoice;
      }

      throw new NotFoundError(`Invoice ${id} could not be created`);
    });
  }

  async ensureDraftInvoice(
    subscription: Subscription,
    metadata: Record<string, string>,
    period: RatingPeriod,
  ): Promise<EnsuredInvoice> {
    const periodStart = period.periodStart.toISOString();
    const existingInvoice = await this.findPeriodInvoice(subscription, periodStart);

    if (existingInvoice) {
      return { invoice: existingInvoice, isCreated: false };
    }

    const id = generateGid(ObjectPrefixEnum.INVOICE);
    const now = await this.fastify.clockService.resolveSubscriptionNow(subscription);
    const createdAt = now.toISOString();

    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const invoice = await this.fastify.invoiceRepository.createInvoice(
          {
            id,
            number: null,
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            status: InvoiceStatusEnum.DRAFT,
            billingReason: BillingReasonEnum.SUBSCRIPTION_CYCLE,
            currency: subscription.currency,
            collectionMethod: subscription.collectionMethod,
            autoAdvance: true,
            daysUntilDue: null,
            periodStart,
            periodEnd: period.periodEnd.toISOString(),
            subtotal: 0,
            total: 0,
            amountPaid: 0,
            defaultTaxRates: subscription.defaultTaxRates,
            finalizedAt: null,
            paidAt: null,
            voidedAt: null,
            metadata,
            createdAt,
            updatedAt: createdAt,
          },
          tx,
        );

        if (invoice) {
          await this.recordInvoiceEvent(invoice, DomainEventTypeEnum.INVOICE_CREATED, tx);

          return { invoice, isCreated: true };
        }

        throw new NotFoundError(`Invoice ${id} could not be created`);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const racedInvoice = await this.findPeriodInvoice(subscription, periodStart);

        if (racedInvoice) {
          return { invoice: racedInvoice, isCreated: false };
        }
      }

      throw error;
    }
  }

  async finalizeInvoice(id: string): Promise<InvoiceResponse> {
    const invoice = await this.fastify.invoiceRepository.getInvoice(id);

    InvoiceService.assertTransition(invoice.status, InvoiceStatusEnum.OPEN);

    const lines = await this.collectInvoiceLines(invoice);
    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);

    const finalizedInvoice = await this.fastify.database.master.transaction(async (tx) => {
      return this.writeFinalizedInvoice(invoice, lines, now, tx);
    });
    const sentInvoice = await this.issueInvoiceDocument(finalizedInvoice);

    return this.buildInvoice(sentInvoice);
  }

  private async issueInvoiceDocument(invoice: Invoice): Promise<Invoice> {
    try {
      return await this.fastify.invoiceDocumentService.issueInvoiceDocument(invoice);
    } catch (error) {
      this.fastify.log.error(
        { error, invoiceId: invoice.id },
        '[InvoiceService] issueInvoiceDocument() error',
      );

      return invoice;
    }
  }

  async ensureBillableDraft(subscription: Subscription): Promise<EnsuredInvoice> {
    const ensured = await this.ensureDraftInvoice(
      subscription,
      {},
      InvoiceService.readCurrentPeriod(subscription),
    );
    const { pauseCollectionBehavior } = subscription;

    if (!ensured.isCreated) {
      return ensured;
    }

    if (pauseCollectionBehavior) {
      await this.applyPauseCollection(ensured.invoice, pauseCollectionBehavior);

      return ensured;
    }

    if (subscription.billingMode === BillingModeEnum.ADVANCE) {
      await this.finalizeInvoice(ensured.invoice.id);

      return {
        invoice: await this.fastify.invoiceRepository.getInvoice(ensured.invoice.id),
        isCreated: true,
      };
    }

    return ensured;
  }

  async issueSubscriptionCreateInvoice(
    subscription: Subscription,
    now: Date,
  ): Promise<InvoiceResponse> {
    const id = generateGid(ObjectPrefixEnum.INVOICE);
    const createdAt = now.toISOString();

    const draft = await this.fastify.database.master.transaction(async (tx) => {
      const invoice = await this.fastify.invoiceRepository.createInvoice(
        {
          id,
          number: null,
          customerId: subscription.customerId,
          subscriptionId: subscription.id,
          status: InvoiceStatusEnum.DRAFT,
          billingReason: BillingReasonEnum.SUBSCRIPTION_CREATE,
          currency: subscription.currency,
          collectionMethod: subscription.collectionMethod,
          autoAdvance: true,
          daysUntilDue: null,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          defaultTaxRates: subscription.defaultTaxRates,
          metadata: {},
          createdAt,
          updatedAt: createdAt,
        },
        tx,
      );

      if (invoice) {
        await this.recordInvoiceEvent(invoice, DomainEventTypeEnum.INVOICE_CREATED, tx);

        return invoice;
      }

      throw new NotFoundError(`Invoice ${id} could not be created`);
    });

    return this.finalizeInvoice(draft.id);
  }

  async issueTrailingInvoice(
    subscription: Subscription,
    endedAt: Date,
    interval: SubscriptionInterval,
  ): Promise<Invoice | null> {
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscription.id],
      deletedAtIsNull: true,
    });

    await this.fastify.subscriptionRepository.closeSubscriptionItemChanges(
      _.map(subscriptionItems, 'id'),
      endedAt.toISOString(),
    );

    const period: RatingPeriod = {
      periodStart: endedAt,
      periodEnd: advancePeriod(endedAt, interval.interval, interval.intervalCount),
    };
    const rated = await this.fastify.ratingService.rateInvoicePeriod(
      subscription.id,
      period.periodStart,
      period.periodEnd,
    );

    if (_.isEmpty(rated.lineItems)) {
      return null;
    }

    const { invoice, isCreated } = await this.ensureDraftInvoice(subscription, {}, period);

    if (isCreated) {
      await this.finalizeInvoice(invoice.id);
    }

    return this.fastify.invoiceRepository.getInvoice(invoice.id);
  }

  private static readCurrentPeriod(subscription: Subscription): RatingPeriod {
    return {
      periodStart: new Date(subscription.currentPeriodStart),
      periodEnd: new Date(subscription.currentPeriodEnd),
    };
  }

  async markInvoiceUncollectible(id: string): Promise<InvoiceResponse> {
    const invoice = await this.fastify.invoiceRepository.getInvoice(id);

    InvoiceService.assertTransition(invoice.status, InvoiceStatusEnum.UNCOLLECTIBLE);

    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);

    const abandonedInvoice = await this.fastify.database.master.transaction(async (tx) => {
      const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        {
          status: InvoiceStatusEnum.UNCOLLECTIBLE,
          nextAttemptAt: null,
          updatedAt: now.toISOString(),
        },
        tx,
      );

      if (updatedInvoice) {
        await this.recordInvoiceEvent(
          updatedInvoice,
          DomainEventTypeEnum.INVOICE_MARKED_UNCOLLECTIBLE,
          tx,
        );

        return updatedInvoice;
      }

      throw new NotFoundError(`No such invoice: ${invoice.id}`);
    });

    return this.buildInvoice(abandonedInvoice);
  }

  async applyPauseCollection(
    invoice: Invoice,
    behavior: PauseCollectionBehavior,
  ): Promise<InvoiceResponse> {
    if (behavior === PauseCollectionBehaviorEnum.VOID) {
      return this.voidInvoice(invoice.id, {});
    }

    if (behavior === PauseCollectionBehaviorEnum.MARK_UNCOLLECTIBLE) {
      const open = await this.finalizeInvoice(invoice.id);

      return this.markInvoiceUncollectible(open.id);
    }

    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);
    const held = await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
      autoAdvance: false,
      updatedAt: now.toISOString(),
    });

    if (held) {
      return this.buildInvoice(held);
    }

    throw new NotFoundError(`No such invoice: ${invoice.id}`);
  }

  private async collectInvoiceLines(invoice: Invoice): Promise<InvoiceDraftLine[]> {
    const subscriptionLines = await this.collectSubscriptionLines(invoice);
    const invoiceItemLines = await this.collectInvoiceItemLines(invoice);

    return [...subscriptionLines, ...invoiceItemLines];
  }

  private async collectSubscriptionLines(invoice: Invoice): Promise<InvoiceDraftLine[]> {
    const { subscriptionId } = invoice;

    if (!subscriptionId) {
      return [];
    }

    const subscription = await this.fastify.subscriptionRepository.getSubscription(subscriptionId);
    const periodStart = new Date(invoice.periodStart);
    const periodEnd = new Date(invoice.periodEnd);
    const rated = await this.fastify.ratingService.rateInvoicePeriod(
      subscriptionId,
      periodStart,
      periodEnd,
    );

    return this.buildSubscriptionLines(subscription, rated.lineItems);
  }

  private async buildSubscriptionLines(
    subscription: Subscription,
    lineItems: RatedInvoiceResponse['lineItems'],
  ): Promise<InvoiceDraftLine[]> {
    const taxBehaviorByPriceId = await this.resolveTaxBehaviors(_.map(lineItems, 'priceId'));
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscription.id],
    });
    const taxRateIdsBySubscriptionItemId = _.mapValues(
      _.keyBy(subscriptionItems, 'id'),
      'taxRates',
    );

    return _.map(lineItems, (lineItem): InvoiceDraftLine => {
      const itemTaxRateIds = _.get(taxRateIdsBySubscriptionItemId, lineItem.subscriptionItemId, []);

      return {
        subscriptionItemId: lineItem.subscriptionItemId,
        subscriptionItemChangeId: lineItem.subscriptionItemChangeId,
        invoiceItemId: null,
        priceId: lineItem.priceId,
        type: lineItem.type,
        description: '',
        quantity: lineItem.quantity,
        unitAmount: null,
        amount: lineItem.amount,
        discountable: true,
        discountAmounts: [],
        taxAmounts: [],
        taxRateIds: itemTaxRateIds,
        taxBehavior: _.get(taxBehaviorByPriceId, lineItem.priceId, TaxBehaviorEnum.UNSPECIFIED),
        periodStart: lineItem.periodStart,
        periodEnd: lineItem.periodEnd,
        prorationFactor: lineItem.prorationFactor,
        isCredit: lineItem.isCredit,
      };
    });
  }

  private async resolveTaxBehaviors(
    priceIds: readonly (string | null)[],
  ): Promise<Record<string, TaxBehavior>> {
    const ids = _.uniq(_.compact([...priceIds]));

    if (_.isEmpty(ids)) {
      return {};
    }

    const prices = await this.fastify.priceRepository.findPrices({ ids }, ids.length);

    return _.mapValues(_.keyBy(prices, 'id'), 'taxBehavior');
  }

  private async collectInvoiceItemLines(invoice: Invoice): Promise<InvoiceDraftLine[]> {
    const invoiceItems = await this.fastify.invoiceItemRepository.findInvoiceItems({
      customerId: invoice.customerId,
      currency: invoice.currency,
      pendingForInvoiceId: invoice.id,
    });

    const taxBehaviorByPriceId = await this.resolveTaxBehaviors(_.map(invoiceItems, 'priceId'));

    return _.map(invoiceItems, (invoiceItem): InvoiceDraftLine => {
      const { priceId } = invoiceItem;
      const taxBehavior =
        priceId === null
          ? TaxBehaviorEnum.UNSPECIFIED
          : _.get(taxBehaviorByPriceId, priceId, TaxBehaviorEnum.UNSPECIFIED);

      return {
        subscriptionItemId: null,
        subscriptionItemChangeId: null,
        invoiceItemId: invoiceItem.id,
        priceId,
        type: LineItemTypeEnum.INVOICEITEM,
        description: invoiceItem.description,
        quantity: invoiceItem.quantity,
        unitAmount: invoiceItem.unitAmount,
        amount: invoiceItem.amount,
        discountable: invoiceItem.discountable,
        discountAmounts: [],
        taxAmounts: [],
        taxRateIds: invoiceItem.taxRates,
        taxBehavior,
        periodStart: invoiceItem.periodStart,
        periodEnd: invoiceItem.periodEnd,
        prorationFactor: 1,
        isCredit: false,
      };
    });
  }

  private static assembleInvoiceTotals(
    lines: readonly InvoiceDraftLine[],
    startingBalance: number,
  ): InvoiceTotals {
    const subtotal = _.sumBy(lines, 'amount');
    const totalDiscountAmount = _.sumBy(lines, (line) => {
      return _.sumBy(line.discountAmounts, 'amount');
    });
    const totalTaxAmount = _.sumBy(lines, (line) => {
      return _.sumBy(line.taxAmounts, 'amount');
    });
    const inclusiveTaxAmount = _.sumBy(lines, (line) => {
      return _.sumBy(_.filter(line.taxAmounts, 'isInclusive'), 'amount');
    });

    const total = subtotal - totalDiscountAmount + (totalTaxAmount - inclusiveTaxAmount);
    const settled = total + startingBalance;

    return {
      subtotal,
      subtotalExcludingTax: subtotal - inclusiveTaxAmount,
      totalDiscountAmount,
      totalTaxAmount,
      total,
      startingBalance,
      endingBalance: Math.min(settled, 0),
      amountDue: Math.max(settled, 0),
    };
  }

  async issueProrationInvoice(
    subscription: Subscription,
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<Invoice | null> {
    const rated = await this.fastify.ratingService.rateProrationInvoice(subscription.id, tx);

    if (_.isEmpty(rated.lineItems) || rated.total <= 0) {
      return null;
    }

    const id = generateGid(ObjectPrefixEnum.INVOICE);
    const createdAt = now.toISOString();
    const invoice = await this.fastify.invoiceRepository.createInvoice(
      {
        id,
        number: null,
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
        status: InvoiceStatusEnum.DRAFT,
        billingReason: BillingReasonEnum.SUBSCRIPTION_UPDATE,
        currency: subscription.currency,
        collectionMethod: subscription.collectionMethod,
        autoAdvance: true,
        daysUntilDue: null,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        subtotal: 0,
        total: 0,
        amountPaid: 0,
        defaultTaxRates: subscription.defaultTaxRates,
        finalizedAt: null,
        paidAt: null,
        voidedAt: null,
        metadata: {},
        createdAt,
        updatedAt: createdAt,
      },
      tx,
    );

    if (invoice) {
      await this.recordInvoiceEvent(invoice, DomainEventTypeEnum.INVOICE_CREATED, tx);

      const lines = await this.buildSubscriptionLines(subscription, rated.lineItems);

      return this.writeFinalizedInvoice(invoice, lines, now, tx);
    }

    throw new NotFoundError(`Invoice ${id} could not be created`);
  }

  private async writeFinalizedInvoice(
    invoice: Invoice,
    lines: readonly InvoiceDraftLine[],
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<Invoice> {
    const customer = await this.fastify.customerRepository.getLockedCustomer(
      invoice.customerId,
      tx,
    );
    const discountedLines = await this.fastify.discountService.applyDiscounts(invoice, lines, tx);
    const { lines: taxedLines, automaticTaxStatus } = await this.fastify.taxService.applyTaxes(
      invoice,
      customer,
      discountedLines,
    );
    const totals = InvoiceService.assembleInvoiceTotals(taxedLines, customer.balance);
    const finalizedAt = now.toISOString();
    const dueAt = this.resolveDueAt(invoice, now).toISOString();

    const lineItems = _.map(taxedLines, (line): NewInvoiceLineItem => {
      return {
        id: generateGid(ObjectPrefixEnum.INVOICE_LINE_ITEM),
        invoiceId: invoice.id,
        subscriptionItemId: line.subscriptionItemId,
        subscriptionItemChangeId: line.subscriptionItemChangeId,
        invoiceItemId: line.invoiceItemId,
        priceId: line.priceId,
        type: line.type,
        description: line.description,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        amount: line.amount,
        amountExcludingTax:
          line.amount - _.sumBy(_.filter(line.taxAmounts, 'isInclusive'), 'amount'),
        discountable: line.discountable,
        discountAmounts: line.discountAmounts,
        periodStart: line.periodStart,
        periodEnd: line.periodEnd,
        prorationFactor: line.prorationFactor,
        createdAt: finalizedAt,
      };
    });
    const taxAmounts = InvoiceService.buildLineItemTaxAmounts(
      invoice,
      taxedLines,
      lineItems,
      finalizedAt,
    );

    const sequenceValue = await this.fastify.numberSequenceRepository.claimNumberSequence(
      NumberSequenceEnum.INVOICE,
      tx,
    );

    if (sequenceValue === null) {
      throw new NotFoundError('Invoice number sequence is not provisioned');
    }

    await this.fastify.invoiceRepository.createInvoiceLineItems(lineItems, tx);
    await this.fastify.invoiceRepository.createInvoiceLineItemTaxAmounts(taxAmounts, tx);
    await this.markInvoicedWindows(invoice, taxedLines, tx);
    await this.fastify.invoiceItemRepository.attachInvoiceItems(
      _.compact(_.map(lines, 'invoiceItemId')),
      invoice.id,
      finalizedAt,
      tx,
    );

    const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
      invoice.id,
      {
        number: InvoiceService.formatNumber(INVOICE_NUMBER_PREFIX, sequenceValue),
        status: InvoiceStatusEnum.OPEN,
        hostedInvoiceUrl: this.fastify.hostedUrlFactory.buildInvoiceUrl(invoice.id),
        invoicePdf: this.fastify.hostedUrlFactory.buildInvoicePdfUrl(invoice.id),
        ...totals,
        automaticTaxStatus,
        finalizedAt,
        dueAt,
        nextAttemptAt: InvoiceService.resolveNextAttemptAt(invoice, dueAt),
        updatedAt: finalizedAt,
      },
      tx,
    );

    if (updatedInvoice) {
      await this.applyCustomerBalance(updatedInvoice, totals, finalizedAt, tx);
      await this.postReceivable(updatedInvoice, totals, tx);
      await this.recordInvoiceEvent(updatedInvoice, DomainEventTypeEnum.INVOICE_FINALIZED, tx);

      return updatedInvoice;
    }

    throw new NotFoundError(`No such invoice: ${invoice.id}`);
  }

  private async markInvoicedWindows(
    invoice: Invoice,
    lines: readonly InvoiceDraftLine[],
    tx: DatabaseTransaction,
  ): Promise<void> {
    const { subscriptionId } = invoice;

    if (!subscriptionId) {
      return;
    }

    const subscription = await this.fastify.subscriptionRepository.getSubscription(subscriptionId);

    if (subscription.billingMode === BillingModeEnum.ARREARS) {
      if (invoice.billingReason === BillingReasonEnum.SUBSCRIPTION_UPDATE) {
        await this.fastify.subscriptionRepository.markSubscriptionItemChangesInvoiced(
          _.compact(_.map(lines, 'subscriptionItemChangeId')),
          tx,
        );
      }

      return;
    }

    const chargesByPeriodEnd = _.groupBy(_.reject(lines, 'isCredit'), 'periodEnd');

    for (const [periodEnd, chargedLines] of _.toPairs(chargesByPeriodEnd)) {
      await this.fastify.subscriptionRepository.invoiceSubscriptionItemChanges(
        _.compact(_.map(chargedLines, 'subscriptionItemChangeId')),
        periodEnd,
        tx,
      );
    }

    await this.fastify.subscriptionRepository.markSubscriptionItemChangesInvoiced(
      _.compact(_.map(_.filter(lines, 'isCredit'), 'subscriptionItemChangeId')),
      tx,
    );
  }

  private static buildLineItemTaxAmounts(
    invoice: Invoice,
    lines: readonly InvoiceDraftLine[],
    lineItems: readonly NewInvoiceLineItem[],
    createdAt: string,
  ): NewInvoiceLineItemTaxAmount[] {
    return _.flatMap(lines, (line, index): NewInvoiceLineItemTaxAmount[] => {
      const lineItem = lineItems[index];

      if (!lineItem) {
        return [];
      }

      return _.map(line.taxAmounts, (taxAmount): NewInvoiceLineItemTaxAmount => {
        return {
          id: generateGid(ObjectPrefixEnum.INVOICE_LINE_TAX_AMOUNT),
          invoiceId: invoice.id,
          invoiceLineItemId: lineItem.id,
          taxRateId: taxAmount.taxRateId,
          amount: taxAmount.amount,
          taxableAmount: taxAmount.taxableAmount,
          isInclusive: taxAmount.isInclusive,
          percentage: taxAmount.percentage,
          taxType: taxAmount.taxType,
          createdAt,
        };
      });
    });
  }

  private static resolveNextAttemptAt(invoice: Invoice, dueAt: string): string | null {
    if (_.includes(AUTOMATIC_COLLECTION_METHODS, invoice.collectionMethod)) {
      return dueAt;
    }

    return null;
  }

  async advanceDraftInvoices(
    finalizeBeforeAt: Date,
    shardCount: number,
    shardIndex: number,
    limit: number,
  ): Promise<number> {
    const drafts = await this.fastify.invoiceRepository.findInvoices(
      {
        status: InvoiceStatusEnum.DRAFT,
        autoAdvance: true,
        createdBeforeAt: finalizeBeforeAt.toISOString(),
        shardCount,
        shardIndex,
      },
      limit,
    );

    let advanced = 0;

    for (const draft of drafts) {
      try {
        await this.finalizeInvoice(draft.id);
        advanced += 1;
      } catch (error) {
        this.fastify.log.error(
          { error, invoiceId: draft.id },
          '[InvoiceService] advanceDraftInvoices() error',
        );
      }
    }

    return advanced;
  }

  private resolveDueAt(invoice: Invoice, now: Date): Date {
    const { daysUntilDue } = invoice;

    if (daysUntilDue === null) {
      return new Date(now.getTime() + this.config.dueDays * MILLISECONDS_PER_DAY);
    }

    return new Date(now.getTime() + daysUntilDue * MILLISECONDS_PER_DAY);
  }

  private async applyCustomerBalance(
    invoice: Invoice,
    totals: InvoiceTotals,
    appliedAt: string,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const movement = totals.endingBalance - totals.startingBalance;

    if (movement === 0) {
      return;
    }

    await this.fastify.customerRepository.updateCustomer(
      invoice.customerId,
      { balance: totals.endingBalance, updatedAt: appliedAt },
      tx,
    );

    await this.fastify.customerBalanceTransactionRepository.createCustomerBalanceTransaction(
      {
        id: generateGid(ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION),
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        creditNoteId: null,
        type: CustomerBalanceTransactionTypeEnum.APPLIED_TO_INVOICE,
        currency: invoice.currency,
        amount: movement,
        endingBalance: totals.endingBalance,
        description: `Applied to invoice ${invoice.number}`,
        metadata: {},
        createdAt: appliedAt,
      },
      tx,
    );
  }

  async payInvoice(
    id: string,
    payload: PayInvoicePayload,
    settlementReference?: string,
  ): Promise<InvoiceResponse> {
    const invoice = await this.fastify.invoiceRepository.getInvoice(id);

    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);

    const paidInvoice = await this.fastify.database.master.transaction(async (tx) => {
      return this.settleInvoice(id, { amount: payload.amount, settlementReference }, now, tx);
    });

    return this.buildInvoice(paidInvoice);
  }

  async applyInvoicePayment(
    id: string,
    payload: ApplyInvoicePaymentPayload,
    tx: DatabaseTransaction,
  ): Promise<Invoice> {
    const invoice = await this.fastify.invoiceRepository.getInvoice(id);

    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);

    return this.settleInvoice(id, payload, now, tx);
  }

  private async settleInvoice(
    id: string,
    payload: ApplyInvoicePaymentPayload,
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<Invoice> {
    const invoice = await this.fastify.invoiceRepository.getLockedInvoice(id, tx);

    InvoiceService.assertTransition(invoice.status, InvoiceStatusEnum.PAID);

    const creditedByInvoiceId = await this.resolveCreditedAmounts([invoice.id]);
    const amountCredited = _.get(creditedByInvoiceId, invoice.id, 0);
    const owed = invoice.amountDue - invoice.amountPaid - amountCredited;
    const { amount = owed } = payload;

    if (amount > owed) {
      throw new BadRequestError(
        `Payment of ${amount} exceeds the ${owed} still owed on invoice ${id}`,
        { param: 'amount' },
      );
    }

    const amountPaid = invoice.amountPaid + amount;
    const isSettled = amountPaid + amountCredited >= invoice.amountDue;
    const paidAt = now.toISOString();
    const status = isSettled ? InvoiceStatusEnum.PAID : invoice.status;
    const settledPaidAt = isSettled ? paidAt : null;
    const nextAttemptAt = isSettled ? null : invoice.nextAttemptAt;

    const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
      invoice.id,
      {
        amountPaid,
        attempted: true,
        status,
        paidAt: settledPaidAt,
        nextAttemptAt,
        updatedAt: paidAt,
      },
      tx,
    );

    if (updatedInvoice) {
      await this.fastify.invoiceRepository.createInvoicePayment(
        {
          id: generateGid(ObjectPrefixEnum.INVOICE_PAYMENT),
          invoiceId: invoice.id,
          paymentIntentId: payload.paymentIntentId ?? null,
          chargeId: payload.chargeId ?? null,
          amount,
          settlementReference: payload.settlementReference ?? null,
          paidAt,
          createdAt: paidAt,
        },
        tx,
      );

      if (!payload.chargeId) {
        await this.postInvoiceReceipt(updatedInvoice, amount, payload, tx);
      }

      if (isSettled) {
        await this.recordInvoiceEvent(updatedInvoice, DomainEventTypeEnum.INVOICE_PAID, tx);
      }

      return updatedInvoice;
    }

    throw new NotFoundError(`No such invoice: ${invoice.id}`);
  }

  async voidInvoice(id: string, payload: VoidInvoicePayload): Promise<InvoiceResponse> {
    const invoice = await this.fastify.invoiceRepository.getInvoice(id);

    InvoiceService.assertTransition(invoice.status, InvoiceStatusEnum.VOID);

    if (invoice.amountPaid > 0) {
      throw new ConflictError(
        `Invoice ${id} has been paid and can only be corrected with a credit note`,
      );
    }

    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);
    const voidedAt = now.toISOString();

    const voidedInvoice = await this.fastify.database.master.transaction(async (tx) => {
      const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        {
          status: InvoiceStatusEnum.VOID,
          voidedAt,
          metadata: { ...invoice.metadata, ...payload.metadata },
          updatedAt: voidedAt,
        },
        tx,
      );

      if (updatedInvoice) {
        if (invoice.status === InvoiceStatusEnum.OPEN) {
          await this.reverseReceivable(updatedInvoice, tx);
          await this.restoreCustomerBalance(updatedInvoice, voidedAt, tx);
        }

        if (invoice.billingReason === BillingReasonEnum.SUBSCRIPTION_UPDATE) {
          await this.reopenInvoicedItems(invoice.id, tx);
        }

        await this.recordInvoiceEvent(updatedInvoice, DomainEventTypeEnum.INVOICE_VOIDED, tx);

        return updatedInvoice;
      }

      throw new NotFoundError(`No such invoice: ${invoice.id}`);
    });

    return this.buildInvoice(voidedInvoice);
  }

  async getInvoice(id: string): Promise<InvoiceResponse> {
    const invoice = await this.fastify.invoiceRepository.getInvoice(id);

    return this.buildInvoice(invoice);
  }

  async findCustomerInvoices(
    customerId: string,
    query: FindPortalInvoicesQuery,
  ): Promise<ListResponse<InvoiceResponse>> {
    const { isOverdue, ...pageQuery } = query;

    if (isOverdue === undefined) {
      return this.findInvoices(
        { ...pageQuery, customerId },
        { statuses: CUSTOMER_VISIBLE_INVOICE_STATUSES },
      );
    }

    const now = await this.fastify.clockService.resolveCustomerNow(customerId);
    const dueFilters: InvoiceFilters = isOverdue
      ? { dueBeforeAt: now.toISOString() }
      : { dueAfterAt: now.toISOString() };

    return this.findInvoices(
      { ...pageQuery, customerId },
      { ...dueFilters, statuses: [InvoiceStatusEnum.OPEN] },
    );
  }

  async getCustomerInvoice(customerId: string, id: string): Promise<InvoiceResponse> {
    const invoice = await this.fastify.invoiceRepository.findInvoice(id);
    const isVisible =
      invoice !== null &&
      invoice.customerId === customerId &&
      _.includes(CUSTOMER_VISIBLE_INVOICE_STATUSES, invoice.status);

    if (invoice && isVisible) {
      return this.buildInvoice(invoice);
    }

    throw new NotFoundError(`No such invoice: ${id}`);
  }

  async findCustomerInvoicePayments(
    customerId: string,
    query: FindPortalPaymentsQuery,
  ): Promise<ListResponse<PortalPaymentResponse>> {
    const INVOICE_SCAN_LIMIT = 1000;

    const { limit = DEFAULT_PAGE_LIMIT, invoiceId } = query;
    const invoices = await this.fastify.invoiceRepository.findInvoices(
      { customerId, statuses: CUSTOMER_VISIBLE_INVOICE_STATUSES },
      INVOICE_SCAN_LIMIT,
    );
    const scopedInvoices = invoiceId ? _.filter(invoices, { id: invoiceId }) : invoices;
    const invoicesById = _.keyBy(scopedInvoices, 'id');
    const invoicePayments = await this.fastify.invoiceRepository.findInvoicePayments(
      _.map(scopedInvoices, 'id'),
    );
    const orderedPayments = _.orderBy(invoicePayments, ['paidAt', 'id'], ['desc', 'desc']);

    return {
      url: '/portal/payments',
      hasMore: orderedPayments.length > limit,
      data: _(orderedPayments)
        .take(limit)
        .flatMap((invoicePayment) => {
          const invoice = invoicesById[invoicePayment.invoiceId];

          if (invoice) {
            return [
              {
                id: invoicePayment.id,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number,
                amount: invoicePayment.amount,
                currency: invoice.currency,
                channel: InvoiceService.resolvePaymentChannel(invoicePayment, invoice),
                paidAt: invoicePayment.paidAt,
              },
            ];
          }

          return [];
        })
        .value(),
    };
  }

  async exportCustomerInvoices(
    customerId: string,
    query: FindPortalInvoicesQuery,
  ): Promise<string> {
    const EXPORT_PAGE_SIZE = 100;
    const EXPORT_ROW_LIMIT = 5000;

    const exportedInvoices: InvoiceResponse[] = [];

    let startingAfter: string | undefined;
    let hasMore = true;

    while (hasMore && exportedInvoices.length < EXPORT_ROW_LIMIT) {
      const page = await this.findCustomerInvoices(customerId, {
        ...query,
        limit: EXPORT_PAGE_SIZE,
        startingAfter,
      });
      const lastInvoice = _.last(page.data);

      exportedInvoices.push(...page.data);
      hasMore = page.hasMore && lastInvoice !== undefined;
      startingAfter = _.get(lastInvoice, 'id');
    }

    const now = await this.fastify.clockService.resolveCustomerNow(customerId);

    return buildInvoicesCsv(exportedInvoices, now);
  }

  async getCustomerInvoiceComparison(
    customerId: string,
    invoiceId: string,
  ): Promise<PortalInvoiceComparisonResponse> {
    const invoice = await this.getCustomerInvoice(customerId, invoiceId);
    const PREVIOUS_INVOICE_LOOKUP_LIMIT = 2;

    const earlierInvoices = await this.fastify.invoiceRepository.findInvoices(
      {
        customerId,
        subscriptionId: invoice.subscriptionId ?? undefined,
        statuses: CUSTOMER_VISIBLE_INVOICE_STATUSES,
        periodEndBeforeAt: invoice.periodStart,
      },
      PREVIOUS_INVOICE_LOOKUP_LIMIT,
    );
    const [previousInvoice] = _.reject(earlierInvoices, { id: invoice.id });

    if (previousInvoice) {
      const previousLineItems = await this.fastify.invoiceRepository.findInvoiceLineItems([
        previousInvoice.id,
      ]);

      return {
        invoiceId: invoice.id,
        previousInvoiceId: previousInvoice.id,
        previousInvoiceNumber: previousInvoice.number,
        currency: invoice.currency,
        currentTotal: invoice.total,
        previousTotal: previousInvoice.total,
        difference: invoice.total - previousInvoice.total,
        lines: InvoiceService.buildInvoiceLineComparison(invoice.lineItems, previousLineItems),
      };
    }

    return {
      invoiceId: invoice.id,
      previousInvoiceId: null,
      previousInvoiceNumber: null,
      currency: invoice.currency,
      currentTotal: invoice.total,
      previousTotal: 0,
      difference: 0,
      lines: [],
    };
  }

  async findCustomerInvoiceReminders(
    customerId: string,
    invoiceId: string,
  ): Promise<PortalInvoiceRemindersResponse> {
    const invoice = await this.getCustomerInvoice(customerId, invoiceId);
    const invoiceReminders = await this.fastify.invoiceRepository.findInvoiceReminders([
      invoice.id,
    ]);

    return {
      reminders: _(invoiceReminders)
        .reject({ kind: InvoiceReminderKindEnum.OVERDUE_INTERNAL })
        .sortBy('sentAt')
        .map((invoiceReminder) => {
          return { kind: invoiceReminder.kind, sentAt: invoiceReminder.sentAt };
        })
        .value(),
    };
  }

  async aggregateCustomerInvoiceTotals(customerId: string): Promise<PortalInvoiceTotalsResponse> {
    const OPEN_INVOICE_LIMIT = 1000;
    const DUE_SOON_DAYS = 7;

    const now = await this.fastify.clockService.resolveCustomerNow(customerId);
    const openInvoices = await this.fastify.invoiceRepository.findInvoices(
      { customerId, status: InvoiceStatusEnum.OPEN },
      OPEN_INVOICE_LIMIT,
    );
    const creditedByInvoiceId = await this.resolveCreditedAmounts(_.map(openInvoices, 'id'));
    const balances = _.map(openInvoices, (invoice) => {
      const amountCredited = _.get(creditedByInvoiceId, invoice.id, 0);

      return {
        currency: invoice.currency,
        amountRemaining: InvoiceService.resolveAmountRemaining(invoice, amountCredited),
        dueAt: invoice.dueAt,
      };
    });
    const dueSoonBeforeAt = new Date(now.getTime() + DUE_SOON_DAYS * MILLISECONDS_PER_DAY);

    return { totals: buildInvoiceTotals(balances, now, dueSoonBeforeAt) };
  }

  async findInvoices(
    query: FindInvoicesQuery,
    filters: Pick<InvoiceFilters, 'statuses' | 'dueBeforeAt' | 'dueAfterAt'> = {},
  ): Promise<ListResponse<InvoiceResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.invoiceRepository.findInvoices(
      {
        ...filters,
        customerId: query.customerId,
        subscriptionId: query.subscriptionId,
        status: query.status,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );
    const page = _.take(rows, limit);
    const invoiceIds = _.map(page, 'id');
    const lineItemsByInvoiceId = await this.resolveLineItems(invoiceIds);
    const taxAmountsByLineItemId = await this.resolveLineItemTaxAmounts(invoiceIds);
    const creditedByInvoiceId = await this.resolveCreditedAmounts(invoiceIds);
    const refundedByInvoiceId = await this.resolveRefundedAmounts(invoiceIds);

    return {
      url: '/v1/invoices',
      hasMore: rows.length > limit,
      data: _.map(page, (invoice) => {
        const lineItems = _.get(lineItemsByInvoiceId, invoice.id, []);
        const amountCredited = _.get(creditedByInvoiceId, invoice.id, 0);
        const amountRefunded = _.get(refundedByInvoiceId, invoice.id, 0);

        return InvoiceService.buildInvoiceWithLineItems(
          invoice,
          lineItems,
          taxAmountsByLineItemId,
          amountCredited,
          amountRefunded,
        );
      }),
    };
  }

  private async reopenInvoicedItems(invoiceId: string, tx: DatabaseTransaction): Promise<void> {
    const lineItems = await this.fastify.invoiceRepository.findInvoiceLineItems([invoiceId]);
    const changeIds = _.compact(_.map(lineItems, 'subscriptionItemChangeId'));

    await this.fastify.subscriptionRepository.reopenSubscriptionItemChangeInvoicing(changeIds, tx);
  }

  private async findPeriodInvoice(
    subscription: Subscription,
    periodStart: string,
  ): Promise<Invoice | null> {
    const [invoice] = await this.fastify.invoiceRepository.findInvoices(
      {
        subscriptionId: subscription.id,
        billingReason: BillingReasonEnum.SUBSCRIPTION_CYCLE,
        periodStart,
      },
      1,
    );

    return invoice ?? null;
  }

  private async postReceivable(
    invoice: Invoice,
    totals: InvoiceTotals,
    tx: DatabaseTransaction,
  ): Promise<void> {
    if (totals.total <= 0) {
      return;
    }

    const revenue = totals.total - totals.totalTaxAmount;
    const appliedBalance = totals.total - totals.amountDue;

    const entries = [
      {
        accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
        customerId: invoice.customerId,
        direction: PostingDirectionEnum.DEBIT,
        amount: totals.amountDue,
      },
      {
        accountCode: LedgerAccountCodeEnum.REVENUE,
        direction: PostingDirectionEnum.CREDIT,
        amount: revenue,
      },
    ];

    if (totals.totalTaxAmount > 0) {
      entries.push({
        accountCode: LedgerAccountCodeEnum.TAX_PAYABLE,
        direction: PostingDirectionEnum.CREDIT,
        amount: totals.totalTaxAmount,
      });
    }

    if (appliedBalance !== 0) {
      const direction =
        appliedBalance > 0 ? PostingDirectionEnum.DEBIT : PostingDirectionEnum.CREDIT;

      entries.push({
        accountCode: LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
        customerId: invoice.customerId,
        direction,
        amount: Math.abs(appliedBalance),
      });
    }

    await this.fastify.ledgerService.postTransaction(
      {
        description: `Invoice ${invoice.number} issued`,
        currency: invoice.currency,
        externalId: `invoice:${invoice.id}`,
        entries: _.filter(entries, (entry) => {
          return entry.amount > 0;
        }),
      },
      tx,
    );
  }

  private async postInvoiceReceipt(
    invoice: Invoice,
    amount: number,
    payload: ApplyInvoicePaymentPayload,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const {
      settlementReference: externalId = `invoice_payment:${invoice.id}:${invoice.amountPaid}`,
      clearingAccountCode = LedgerAccountCodeEnum.CASH,
    } = payload;

    await this.fastify.ledgerService.postTransaction(
      {
        description: `Invoice ${invoice.number} payment`,
        currency: invoice.currency,
        externalId,
        entries: [
          {
            accountCode: clearingAccountCode,
            direction: PostingDirectionEnum.DEBIT,
            amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
            customerId: invoice.customerId,
            direction: PostingDirectionEnum.CREDIT,
            amount,
          },
        ],
      },
      tx,
    );
  }

  private async reverseReceivable(invoice: Invoice, tx: DatabaseTransaction): Promise<void> {
    if (invoice.total <= 0) {
      return;
    }

    const revenue = invoice.total - invoice.totalTaxAmount;
    const appliedBalance = invoice.total - invoice.amountDue;

    const entries = [
      {
        accountCode: LedgerAccountCodeEnum.REVENUE,
        direction: PostingDirectionEnum.DEBIT,
        amount: revenue,
      },
      {
        accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
        customerId: invoice.customerId,
        direction: PostingDirectionEnum.CREDIT,
        amount: invoice.amountDue,
      },
    ];

    if (invoice.totalTaxAmount > 0) {
      entries.push({
        accountCode: LedgerAccountCodeEnum.TAX_PAYABLE,
        direction: PostingDirectionEnum.DEBIT,
        amount: invoice.totalTaxAmount,
      });
    }

    if (appliedBalance !== 0) {
      const direction =
        appliedBalance > 0 ? PostingDirectionEnum.CREDIT : PostingDirectionEnum.DEBIT;

      entries.push({
        accountCode: LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
        customerId: invoice.customerId,
        direction,
        amount: Math.abs(appliedBalance),
      });
    }

    await this.fastify.ledgerService.postTransaction(
      {
        description: `Invoice ${invoice.number} voided`,
        currency: invoice.currency,
        externalId: `invoice_void:${invoice.id}`,
        entries: _.filter(entries, (entry) => {
          return entry.amount > 0;
        }),
      },
      tx,
    );
  }

  private async restoreCustomerBalance(
    invoice: Invoice,
    unappliedAt: string,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const movement = invoice.endingBalance - invoice.startingBalance;

    if (movement === 0) {
      return;
    }

    const customer = await this.fastify.customerRepository.getLockedCustomer(
      invoice.customerId,
      tx,
    );
    const endingBalance = customer.balance - movement;

    await this.fastify.customerRepository.updateCustomer(
      invoice.customerId,
      { balance: endingBalance, updatedAt: unappliedAt },
      tx,
    );

    await this.fastify.customerBalanceTransactionRepository.createCustomerBalanceTransaction(
      {
        id: generateGid(ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION),
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        creditNoteId: null,
        type: CustomerBalanceTransactionTypeEnum.UNAPPLIED_FROM_INVOICE,
        currency: invoice.currency,
        amount: -movement,
        endingBalance,
        description: `Unapplied from invoice ${invoice.number}`,
        metadata: {},
        createdAt: unappliedAt,
      },
      tx,
    );
  }

  private async recordInvoiceEvent(
    invoice: Invoice,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.INVOICE,
          aggregateId: invoice.id,
          eventType,
          payload: {
            id: invoice.id,
            number: invoice.number,
            customerId: invoice.customerId,
            total: invoice.total,
          },
        },
      ],
      tx,
    );
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const invoice = await this.fastify.invoiceRepository.getInvoice(id);

      return { createdAt: invoice.createdAt, id: invoice.id };
    }

    return undefined;
  }

  private async resolveLineItems(
    invoiceIds: readonly string[],
  ): Promise<Record<string, InvoiceLineItem[]>> {
    const rows = await this.fastify.invoiceRepository.findInvoiceLineItems(invoiceIds);

    return _.groupBy(rows, 'invoiceId');
  }

  private async resolveLineItemTaxAmounts(
    invoiceIds: readonly string[],
  ): Promise<Record<string, InvoiceLineItemTaxAmount[]>> {
    const rows = await this.fastify.invoiceRepository.findInvoiceLineItemTaxAmounts(invoiceIds);

    return _.groupBy(rows, 'invoiceLineItemId');
  }

  private async buildInvoice(invoice: Invoice): Promise<InvoiceResponse> {
    const lineItems = await this.fastify.invoiceRepository.findInvoiceLineItems([invoice.id]);
    const taxAmountsByLineItemId = await this.resolveLineItemTaxAmounts([invoice.id]);
    const creditedByInvoiceId = await this.resolveCreditedAmounts([invoice.id]);
    const refundedByInvoiceId = await this.resolveRefundedAmounts([invoice.id]);

    const amountCredited = _.get(creditedByInvoiceId, invoice.id, 0);
    const amountRefunded = _.get(refundedByInvoiceId, invoice.id, 0);

    return InvoiceService.buildInvoiceWithLineItems(
      invoice,
      lineItems,
      taxAmountsByLineItemId,
      amountCredited,
      amountRefunded,
    );
  }

  private async resolveCreditedAmounts(
    invoiceIds: readonly string[],
  ): Promise<Record<string, number>> {
    const rows = await this.fastify.creditNoteRepository.aggregateCreditedAmounts(invoiceIds, [
      CreditNoteStatusEnum.VOID,
    ]);

    return _.mapValues(_.keyBy(rows, 'invoiceId'), 'creditedAmount');
  }

  private async resolveRefundedAmounts(
    invoiceIds: readonly string[],
  ): Promise<Record<string, number>> {
    const rows = await this.fastify.refundRepository.aggregateRefundedAmounts(invoiceIds, [
      RefundStatusEnum.SUCCEEDED,
    ]);

    return _.mapValues(_.keyBy(rows, 'invoiceId'), 'refundedAmount');
  }

  private static buildInvoiceLineComparison(
    currentLineItems: InvoiceResponse['lineItems'],
    previousLineItems: readonly InvoiceLineItem[],
  ): PortalInvoiceComparisonResponse['lines'] {
    const currentAmountsByDescription = _(currentLineItems)
      .groupBy('description')
      .mapValues((lineItems) => {
        return _.sumBy(lineItems, 'amount');
      })
      .value();
    const previousAmountsByDescription = _(previousLineItems)
      .groupBy('description')
      .mapValues((lineItems) => {
        return _.sumBy(lineItems, 'amount');
      })
      .value();
    const descriptions = _([
      ..._.keys(currentAmountsByDescription),
      ..._.keys(previousAmountsByDescription),
    ])
      .uniq()
      .sort()
      .value();

    return _(descriptions)
      .map((description) => {
        const currentAmount = _.get(currentAmountsByDescription, description, 0);
        const previousAmount = _.get(previousAmountsByDescription, description, 0);

        return {
          description,
          currentAmount,
          previousAmount,
          difference: currentAmount - previousAmount,
        };
      })
      .reject({ difference: 0 })
      .value();
  }

  private static resolvePaymentChannel(
    invoicePayment: InvoicePayment,
    invoice: Invoice,
  ): PortalPaymentChannel {
    const PARTNER_SETTLEMENT_PREFIX = 'collection_attempt:';

    const { paymentIntentId, settlementReference } = invoicePayment;
    const { collectionMethod } = invoice;
    const isPartnerSettlement = _.startsWith(
      _.toString(settlementReference),
      PARTNER_SETTLEMENT_PREFIX,
    );

    if (paymentIntentId) {
      return PortalPaymentChannelEnum.CARD;
    }

    if (isPartnerSettlement && collectionMethod === CollectionMethodEnum.OFFSET_TICKET) {
      return PortalPaymentChannelEnum.OFFSET_TICKET;
    }

    if (isPartnerSettlement && collectionMethod === CollectionMethodEnum.DEBIT_WALLET) {
      return PortalPaymentChannelEnum.DEBIT_WALLET;
    }

    return PortalPaymentChannelEnum.RECORDED;
  }

  private static resolveAmountRemaining(invoice: Invoice, amountCredited: number): number {
    return invoice.amountDue - invoice.amountPaid - amountCredited;
  }

  private static formatNumber(prefix: string, value: number): string {
    return `${prefix}-${_.padStart(String(value), NUMBER_PAD_LENGTH, '0')}`;
  }

  private static assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
    if (_.includes(INVOICE_TRANSITIONS[from], to)) {
      return;
    }

    throw new ConflictError(`An invoice cannot move from ${from} to ${to}`);
  }

  private static buildInvoiceWithLineItems(
    invoice: Invoice,
    lineItems: readonly InvoiceLineItem[],
    taxAmountsByLineItemId: Record<string, InvoiceLineItemTaxAmount[]>,
    amountCredited: number,
    amountRefunded: number,
  ): InvoiceResponse {
    return {
      ...invoice,
      automaticTax: {
        enabled: invoice.automaticTaxEnabled,
        status: invoice.automaticTaxStatus,
      },
      amountCredited,
      amountRefunded,
      amountRemaining: InvoiceService.resolveAmountRemaining(invoice, amountCredited),
      lineItems: _.map(lineItems, (lineItem) => {
        return {
          ...lineItem,
          taxAmounts: _.get(taxAmountsByLineItemId, lineItem.id, []),
        };
      }),
    };
  }
}
