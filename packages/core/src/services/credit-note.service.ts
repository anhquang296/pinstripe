import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type {
  CreateCreditNotePayload,
  CreditNoteResponse,
  GetCreditNotesQuery,
} from '@contracts/invoices.types';
import { InvoiceStatusEnum, NumberSequenceEnum } from '@contracts/invoices.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { CreditNote, Invoice } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const CREDIT_NOTE_NUMBER_PREFIX = 'CN';
const NUMBER_PAD_LENGTH = 6;

export class CreditNoteService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createCreditNote(payload: CreateCreditNotePayload): Promise<CreditNoteResponse> {
    const invoice = await this.getInvoice(payload.invoiceId);

    if (invoice.status === InvoiceStatusEnum.DRAFT) {
      throw new ConflictError(
        `Invoice ${invoice.id} is still a draft and should be edited rather than credited`,
      );
    }

    const creditedAmount = await this.resolveCreditedAmount(invoice.id);
    const creditable = invoice.total - invoice.amountPaid - creditedAmount;

    if (payload.amount > creditable) {
      throw new BadRequestError(
        `A credit note of ${payload.amount} exceeds the ${creditable} still owed on invoice ${invoice.id}; money already paid is returned by a refund, not a credit note`,
        { param: 'amount' },
      );
    }

    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.CREDIT_NOTE);

    const createdCreditNote = await this.fastify.database.master.transaction(async (tx) => {
      const sequenceValue = await this.fastify.numberSequenceRepository.claimNumberSequence(
        NumberSequenceEnum.CREDIT_NOTE,
        tx,
      );

      if (sequenceValue === null) {
        throw new NotFoundError('Credit note number sequence is not provisioned');
      }

      const creditNote = await this.fastify.creditNoteRepository.createCreditNote(
        {
          id,
          number: CreditNoteService.formatNumber(CREDIT_NOTE_NUMBER_PREFIX, sequenceValue),
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          currency: invoice.currency,
          amount: payload.amount,
          reason: payload.reason,
          metadata: payload.metadata ?? {},
          createdAt: now,
        },
        tx,
      );

      if (creditNote) {
        await this.postCredit(creditNote, tx);
        await this.recordCreditNoteEvent(creditNote, tx);

        if (creditable === payload.amount) {
          await this.settleInvoice(invoice, now, tx);
        }

        return creditNote;
      }

      throw new NotFoundError(`Credit note ${id} could not be created`);
    });

    return CreditNoteService.buildCreditNote(createdCreditNote);
  }

  async getCreditNote(id: string): Promise<CreditNoteResponse> {
    const creditNote = await this.fastify.creditNoteRepository.findCreditNote(id);

    if (creditNote) {
      return CreditNoteService.buildCreditNote(creditNote);
    }

    throw new NotFoundError(`No such credit note: ${id}`);
  }

  async findCreditNotes(query: GetCreditNotesQuery): Promise<ListResponse<CreditNoteResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.creditNoteRepository.findCreditNotes(
      { invoiceId: query.invoiceId, customerId: query.customerId, beforeAt, afterAt },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/credit_notes',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(CreditNoteService.buildCreditNote).value(),
    };
  }

  private async settleInvoice(invoice: Invoice, now: Date, tx: DatabaseTransaction): Promise<void> {
    await this.fastify.invoiceRepository.updateInvoice(
      invoice.id,
      {
        status: InvoiceStatusEnum.PAID,
        paidAt: now,
        nextAttemptAt: null,
        updatedAt: now,
      },
      tx,
    );

    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.INVOICE,
          aggregateId: invoice.id,
          eventType: DomainEventTypeEnum.INVOICE_PAID,
          payload: { id: invoice.id, number: invoice.number, total: invoice.total },
        },
      ],
      tx,
    );
  }

  private async resolveCreditedAmount(invoiceId: string): Promise<number> {
    const rows = await this.fastify.creditNoteRepository.findCreditNotes({ invoiceId });

    return _.sumBy(rows, 'amount');
  }

  private async postCredit(creditNote: CreditNote, tx: DatabaseTransaction): Promise<void> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Credit note ${creditNote.number} for invoice ${creditNote.invoiceId}`,
        currency: creditNote.currency,
        externalId: `credit_note:${creditNote.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: PostingDirectionEnum.DEBIT,
            amount: creditNote.amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
            customerId: creditNote.customerId,
            direction: PostingDirectionEnum.CREDIT,
            amount: creditNote.amount,
          },
        ],
      },
      tx,
    );
  }

  private async recordCreditNoteEvent(
    creditNote: CreditNote,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.CREDIT_NOTE,
          aggregateId: creditNote.id,
          eventType: DomainEventTypeEnum.CREDIT_NOTE_CREATED,
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

  private static formatNumber(prefix: string, value: number): string {
    return `${prefix}-${_.padStart(String(value), NUMBER_PAD_LENGTH, '0')}`;
  }

  private static buildCreditNote(entity: CreditNote): CreditNoteResponse {
    return {
      object: 'credit_note',
      id: entity.id,
      number: entity.number,
      invoiceId: entity.invoiceId,
      customerId: entity.customerId,
      currency: entity.currency,
      amount: entity.amount,
      reason: entity.reason,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
