import { CustomerBalanceTransactionTypeEnum } from '@contracts/customers.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type {
  CreateCreditNotePayload,
  CreditNoteResponse,
  CreditNoteStatus,
  FindCreditNotesQuery,
  VoidCreditNotePayload,
} from '@contracts/invoices.types';
import {
  CreditNoteStatusEnum,
  CreditNoteTypeEnum,
  InvoiceStatusEnum,
  NumberSequenceEnum,
} from '@contracts/invoices.types';
import type { PostLedgerTransactionPayload } from '@contracts/ledger.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { DatabaseTransaction } from '@database/database.client';
import type {
  CreditNote,
  CreditNoteLineItem,
  CreditNoteTransition,
  Invoice,
  NewCreditNoteLineItem,
  NewRefund,
} from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const CREDIT_NOTE_NUMBER_PREFIX = 'CN';
const NUMBER_PAD_LENGTH = 6;

interface CreditNoteSplit {
  amount: number;
  refundAmount: number;
  outOfBandAmount: number;
  creditAmount: number;
  type: CreditNoteTypeEnum;
}

export class CreditNoteService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createCreditNote(payload: CreateCreditNotePayload): Promise<CreditNoteResponse> {
    const invoice = await this.getInvoice(payload.invoiceId);

    if (invoice.status === InvoiceStatusEnum.DRAFT) {
      throw new ConflictError(
        `Invoice ${invoice.id} is still a draft and should be edited rather than credited`,
      );
    }

    const split = await this.resolveSplit(invoice, payload);
    const id = generateGid(ObjectPrefixEnum.CREDIT_NOTE);
    const refundPayload = await this.requestRefund(invoice, split, payload.reason, id);
    const now = this.fastify.clock.now().toISOString();

    const createdCreditNote = await this.fastify.database.master.transaction(async (tx) => {
      const sequenceValue = await this.fastify.numberSequenceRepository.claimNumberSequence(
        NumberSequenceEnum.CREDIT_NOTE,
        tx,
      );

      if (sequenceValue === null) {
        throw new NotFoundError('Credit note number sequence is not provisioned');
      }

      const ledgerTransactionId = await this.postCredit(invoice, split, id, tx);
      const creditNote = await this.fastify.creditNoteRepository.createCreditNote(
        {
          id,
          livemode: invoice.livemode,
          number: CreditNoteService.formatNumber(CREDIT_NOTE_NUMBER_PREFIX, sequenceValue),
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          currency: invoice.currency,
          type: split.type,
          amount: split.amount,
          refundAmount: split.refundAmount,
          outOfBandAmount: split.outOfBandAmount,
          creditAmount: split.creditAmount,
          refundId: _.get(refundPayload, 'id', null),
          ledgerTransactionId,
          reason: payload.reason,
          metadata: payload.metadata ?? {},
          createdAt: now,
        },
        CreditNoteService.buildLines(id, invoice.livemode, payload, now),
        tx,
      );

      if (!creditNote) {
        throw new NotFoundError(`Credit note ${id} could not be created`);
      }

      if (refundPayload) {
        await this.fastify.refundService.writeRefund(refundPayload, tx);
      }

      if (split.creditAmount > 0) {
        await this.grantCustomerCredit(creditNote, tx);
      }

      await this.recordTransition(creditNote, CreditNoteStatusEnum.ISSUED, payload.reason, tx);
      await this.recordCreditNoteEvent(creditNote, DomainEventTypeEnum.CREDIT_NOTE_CREATED, tx);

      if (split.type === CreditNoteTypeEnum.PRE_PAYMENT) {
        await this.settleInvoice(invoice, split.amount, now, tx);
      }

      return creditNote;
    });

    const [built] = await this.buildCreditNotes([createdCreditNote]);

    if (built) {
      return built;
    }

    throw new NotFoundError(`No such credit note: ${id}`);
  }

  async voidCreditNote(
    id: string,
    payload: VoidCreditNotePayload,
    livemode: boolean,
  ): Promise<CreditNoteResponse> {
    const creditNote = await this.getCreditNoteEntity(id, livemode);
    const status = await this.resolveStatus(creditNote.id);

    if (status === CreditNoteStatusEnum.VOID) {
      throw new ConflictError(`Credit note ${id} is already void`);
    }

    if (creditNote.refundId || creditNote.creditAmount > 0 || creditNote.outOfBandAmount > 0) {
      throw new ConflictError(
        `Credit note ${id} already returned money and can no longer be voided`,
      );
    }

    const invoice = await this.getInvoice(creditNote.invoiceId);

    if (invoice.status !== InvoiceStatusEnum.OPEN) {
      throw new ConflictError(
        `Invoice ${invoice.id} is ${invoice.status} and its credit notes can no longer be voided`,
      );
    }

    const { ledgerTransactionId } = creditNote;

    if (ledgerTransactionId) {
      await this.fastify.ledgerService.reverseTransaction(ledgerTransactionId, {
        reason: `Credit note ${creditNote.number} voided`,
      });
    }

    await this.fastify.database.master.transaction(async (tx) => {
      await this.recordTransition(
        creditNote,
        CreditNoteStatusEnum.VOID,
        payload.reason ?? null,
        tx,
      );
      await this.recordCreditNoteEvent(creditNote, DomainEventTypeEnum.CREDIT_NOTE_VOIDED, tx);
    });

    const [built] = await this.buildCreditNotes([creditNote]);

    if (built) {
      return built;
    }

    throw new NotFoundError(`No such credit note: ${id}`);
  }

  async getCreditNote(id: string, livemode: boolean): Promise<CreditNoteResponse> {
    const creditNote = await this.getCreditNoteEntity(id, livemode);
    const [built] = await this.buildCreditNotes([creditNote]);

    if (built) {
      return built;
    }

    throw new NotFoundError(`No such credit note: ${id}`);
  }

  async findCreditNotes(
    query: FindCreditNotesQuery,
    livemode: boolean,
  ): Promise<ListResponse<CreditNoteResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.creditNoteRepository.findCreditNotes(
      { livemode, invoiceId: query.invoiceId, customerId: query.customerId, beforeAt, afterAt },
      limit + 1,
    );

    return {
      url: '/v1/credit_notes',
      hasMore: rows.length > limit,
      data: await this.buildCreditNotes(_.take(rows, limit)),
    };
  }

  async resolveStatus(creditNoteId: string): Promise<CreditNoteStatus> {
    const transitions = await this.fastify.creditNoteRepository.findCreditNoteTransitions([
      creditNoteId,
    ]);
    const [latest] = transitions;

    return CreditNoteService.readStatus(latest);
  }

  private async resolveSplit(
    invoice: Invoice,
    payload: CreateCreditNotePayload,
  ): Promise<CreditNoteSplit> {
    const amount = _.sumBy(payload.lines, 'amount');
    const refundAmount = payload.refundAmount ?? 0;
    const outOfBandAmount = payload.outOfBandAmount ?? 0;
    const creditedAmount = await this.resolveCreditedAmount(invoice.id);
    const isPostPayment = invoice.amountPaid > 0;

    if (refundAmount + outOfBandAmount > amount) {
      throw new BadRequestError(
        `A credit note cannot return ${refundAmount + outOfBandAmount} of a ${amount} credit`,
        { param: 'refundAmount' },
      );
    }

    if (!isPostPayment) {
      const creditable = invoice.amountDue - invoice.amountPaid - creditedAmount;

      if (amount > creditable) {
        throw new BadRequestError(
          `A credit note of ${amount} exceeds the ${creditable} still owed on invoice ${invoice.id}`,
          { param: 'lines' },
        );
      }

      if (refundAmount > 0 || outOfBandAmount > 0) {
        throw new BadRequestError(
          `Invoice ${invoice.id} has not been paid, so there is nothing to return`,
          { param: 'refundAmount' },
        );
      }

      return {
        amount,
        refundAmount: 0,
        outOfBandAmount: 0,
        creditAmount: 0,
        type: CreditNoteTypeEnum.PRE_PAYMENT,
      };
    }

    const creditable = invoice.amountPaid - creditedAmount;

    if (amount > creditable) {
      throw new BadRequestError(
        `A credit note of ${amount} exceeds the ${creditable} paid on invoice ${invoice.id}`,
        { param: 'lines' },
      );
    }

    return {
      amount,
      refundAmount,
      outOfBandAmount,
      creditAmount: amount - refundAmount - outOfBandAmount,
      type: CreditNoteTypeEnum.POST_PAYMENT,
    };
  }

  private async requestRefund(
    invoice: Invoice,
    split: CreditNoteSplit,
    reason: string,
    creditNoteId: string,
  ): Promise<NewRefund | null> {
    if (split.refundAmount <= 0) {
      return null;
    }

    const charge = await this.resolveSettledCharge(invoice);

    return this.fastify.refundService.requestRefund(
      charge,
      split.refundAmount,
      reason,
      creditNoteId,
      {},
    );
  }

  private async resolveSettledCharge(invoice: Invoice) {
    const invoicePayments = await this.fastify.invoiceRepository.findInvoicePayments([invoice.id]);
    const chargeId = _(invoicePayments)
      .map('chargeId')
      .filter((candidate): candidate is string => {
        return Boolean(candidate);
      })
      .last();

    if (!chargeId) {
      throw new ConflictError(
        `Invoice ${invoice.id} was not paid by a charge, so nothing can be refunded`,
      );
    }

    const charge = await this.fastify.paymentIntentRepository.findCharge(chargeId);

    if (charge) {
      return charge;
    }

    throw new NotFoundError(`No such charge: ${chargeId}`);
  }

  private async postCredit(
    invoice: Invoice,
    split: CreditNoteSplit,
    creditNoteId: string,
    tx: DatabaseTransaction,
  ): Promise<string | null> {
    const entries = CreditNoteService.buildCreditEntries(invoice, split);

    if (_.isEmpty(entries)) {
      return null;
    }

    const transaction = await this.fastify.ledgerService.postTransaction(
      {
        description: `Credit note for invoice ${invoice.id}`,
        currency: invoice.currency,
        externalId: `credit_note:${creditNoteId}`,
        entries,
      },
      invoice.livemode,
      tx,
    );

    return transaction.id;
  }

  private async grantCustomerCredit(
    creditNote: CreditNote,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const customer = await this.fastify.customerRepository.lockCustomer(creditNote.customerId, tx);

    if (!customer) {
      throw new NotFoundError(`No such customer: ${creditNote.customerId}`);
    }

    const endingBalance = customer.balance - creditNote.creditAmount;

    await this.fastify.customerRepository.updateCustomer(
      customer.id,
      { balance: endingBalance, updatedAt: creditNote.createdAt },
      tx,
    );
    await this.fastify.customerBalanceTransactionRepository.createCustomerBalanceTransaction(
      {
        id: generateGid(ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION),
        livemode: creditNote.livemode,
        customerId: creditNote.customerId,
        invoiceId: creditNote.invoiceId,
        creditNoteId: creditNote.id,
        type: CustomerBalanceTransactionTypeEnum.CREDIT_NOTE,
        currency: creditNote.currency,
        amount: -creditNote.creditAmount,
        endingBalance,
        description: `Credit note ${creditNote.number}`,
        metadata: {},
        createdAt: creditNote.createdAt,
      },
      tx,
    );
  }

  private async settleInvoice(
    invoice: Invoice,
    amount: number,
    paidAt: string,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const creditedAmount = await this.resolveCreditedAmount(invoice.id);
    const owed = invoice.amountDue - invoice.amountPaid - creditedAmount - amount;

    if (owed > 0) {
      return;
    }

    await this.fastify.invoiceRepository.updateInvoice(
      invoice.id,
      {
        status: InvoiceStatusEnum.PAID,
        paidAt,
        nextAttemptAt: null,
        updatedAt: paidAt,
      },
      tx,
    );

    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.INVOICE,
          aggregateId: invoice.id,
          livemode: invoice.livemode,
          eventType: DomainEventTypeEnum.INVOICE_PAID,
          payload: { id: invoice.id, number: invoice.number, total: invoice.total },
        },
      ],
      tx,
    );
  }

  private async resolveCreditedAmount(invoiceId: string): Promise<number> {
    const rows = await this.fastify.creditNoteRepository.aggregateCreditedAmounts(
      [invoiceId],
      [CreditNoteStatusEnum.VOID],
    );

    return _.sumBy(rows, 'creditedAmount');
  }

  private async buildCreditNotes(
    creditNotes: readonly CreditNote[],
  ): Promise<CreditNoteResponse[]> {
    const creditNoteIds = _.map(creditNotes, 'id');
    const lines = await this.fastify.creditNoteRepository.findCreditNoteLineItems(creditNoteIds);
    const transitions =
      await this.fastify.creditNoteRepository.findCreditNoteTransitions(creditNoteIds);
    const linesByCreditNoteId = _.groupBy(lines, 'creditNoteId');
    const latestByCreditNoteId = _.keyBy(
      _.orderBy(transitions, ['occurredAt', 'id'], ['asc', 'asc']),
      'creditNoteId',
    );

    return _.map(creditNotes, (creditNote) => {
      const latest = latestByCreditNoteId[creditNote.id];
      const status = CreditNoteService.readStatus(latest);
      const voidedAt =
        status === CreditNoteStatusEnum.VOID ? _.get(latest, 'occurredAt', null) : null;

      return CreditNoteService.buildCreditNote(
        creditNote,
        _.get(linesByCreditNoteId, creditNote.id, []),
        status,
        voidedAt,
      );
    });
  }

  private async recordTransition(
    creditNote: CreditNote,
    status: CreditNoteStatus,
    reason: string | null,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.creditNoteRepository.createCreditNoteTransition(
      {
        id: generateGid(ObjectPrefixEnum.CREDIT_NOTE_TRANSITION),
        livemode: creditNote.livemode,
        creditNoteId: creditNote.id,
        status,
        reason,
        occurredAt: this.fastify.clock.now().toISOString(),
      },
      tx,
    );
  }

  private async recordCreditNoteEvent(
    creditNote: CreditNote,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.CREDIT_NOTE,
          aggregateId: creditNote.id,
          livemode: creditNote.livemode,
          eventType,
          payload: {
            id: creditNote.id,
            number: creditNote.number,
            invoiceId: creditNote.invoiceId,
            amount: creditNote.amount,
          },
        },
      ],
      tx,
    );
  }

  private async getInvoice(id: string): Promise<Invoice> {
    const invoice = await this.fastify.invoiceRepository.findInvoice(id);

    if (invoice) {
      return invoice;
    }

    throw new NotFoundError(`No such invoice: ${id}`);
  }

  private async getCreditNoteEntity(id: string, livemode: boolean): Promise<CreditNote> {
    const creditNote = await this.fastify.creditNoteRepository.findCreditNote(id);

    if (creditNote && creditNote.livemode === livemode) {
      return creditNote;
    }

    throw new NotFoundError(`No such credit note: ${id}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const creditNote = await this.fastify.creditNoteRepository.findCreditNote(id);

      if (creditNote) {
        return { createdAt: creditNote.createdAt, id: creditNote.id };
      }

      throw new NotFoundError(`No such credit note: ${id}`);
    }

    return undefined;
  }

  private static readStatus(transition: CreditNoteTransition | undefined): CreditNoteStatus {
    return _.get(transition, 'status', CreditNoteStatusEnum.ISSUED);
  }

  private static buildCreditEntries(
    invoice: Invoice,
    split: CreditNoteSplit,
  ): PostLedgerTransactionPayload['entries'] {
    if (split.type === CreditNoteTypeEnum.PRE_PAYMENT) {
      return [
        {
          accountCode: LedgerAccountCodeEnum.REVENUE,
          direction: PostingDirectionEnum.DEBIT,
          amount: split.amount,
        },
        {
          accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
          customerId: invoice.customerId,
          direction: PostingDirectionEnum.CREDIT,
          amount: split.amount,
        },
      ];
    }

    const returned = split.creditAmount + split.outOfBandAmount;

    if (returned <= 0) {
      return [];
    }

    const entries: PostLedgerTransactionPayload['entries'] = [
      {
        accountCode: LedgerAccountCodeEnum.REVENUE,
        direction: PostingDirectionEnum.DEBIT,
        amount: returned,
      },
      {
        accountCode: LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
        customerId: invoice.customerId,
        direction: PostingDirectionEnum.CREDIT,
        amount: split.creditAmount,
      },
      {
        accountCode: LedgerAccountCodeEnum.CASH,
        direction: PostingDirectionEnum.CREDIT,
        amount: split.outOfBandAmount,
      },
    ];

    return _.filter(entries, (entry) => {
      return entry.amount > 0;
    });
  }

  private static buildLines(
    creditNoteId: string,
    livemode: boolean,
    payload: CreateCreditNotePayload,
    createdAt: string,
  ): NewCreditNoteLineItem[] {
    return _.map(payload.lines, (line): NewCreditNoteLineItem => {
      return {
        id: generateGid(ObjectPrefixEnum.CREDIT_NOTE_LINE_ITEM),
        livemode,
        creditNoteId,
        invoiceLineItemId: line.invoiceLineItemId ?? null,
        description: line.description ?? '',
        quantity: line.quantity ?? 1,
        unitAmount: line.unitAmount ?? null,
        amount: line.amount,
        createdAt,
      };
    });
  }

  private static formatNumber(prefix: string, value: number): string {
    return `${prefix}-${_.padStart(String(value), NUMBER_PAD_LENGTH, '0')}`;
  }

  private static buildCreditNote(
    entity: CreditNote,
    lines: CreditNoteLineItem[],
    status: CreditNoteStatus,
    voidedAt: string | null,
  ): CreditNoteResponse {
    return { ...entity, status, lines, voidedAt };
  }
}
