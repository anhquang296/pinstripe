import { CheckoutSessionModeEnum } from '@contracts/checkout.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreatePaymentLinkPayload,
  FindPaymentLinksQuery,
  PaymentLinkResponse,
  UpdatePaymentLinkPayload,
} from '@contracts/payment-links.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { NewPaymentLinkLineItem, PaymentLink, PaymentLinkLineItem } from '@database/schemas';
import { BadRequestError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { HostedResourceEnum } from '@utils/hosted-url';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DEFAULT_QUANTITY = 1;

export class PaymentLinkService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPaymentLink(
    payload: CreatePaymentLinkPayload,
    livemode: boolean,
  ): Promise<PaymentLinkResponse> {
    const priceIds = _.uniq(_.map(payload.lineItems, 'priceId'));
    const prices = await this.fastify.priceRepository.findPrices(
      { ids: priceIds },
      priceIds.length,
    );
    const pricesById = _.keyBy(prices, 'id');
    const currencies = _.uniq(_.map(prices, 'currency'));

    for (const priceId of priceIds) {
      if (!_.get(pricesById, priceId)) {
        throw new NotFoundError(`No such price: ${priceId}`);
      }
    }

    const [currency] = currencies;

    if (!currency || currencies.length > 1) {
      throw new BadRequestError('A payment link carries prices of exactly one currency', {
        param: 'lineItems',
      });
    }

    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.PAYMENT_LINK);
    const lineItems = _.map(payload.lineItems, (lineItem): NewPaymentLinkLineItem => {
      return {
        id: generateGid(ObjectPrefixEnum.PAYMENT_LINK_LINE_ITEM),
        livemode,
        paymentLinkId: id,
        priceId: lineItem.priceId,
        quantity: lineItem.quantity ?? DEFAULT_QUANTITY,
        createdAt: now,
      };
    });

    const createdPaymentLink = await this.fastify.database.master.transaction(async (tx) => {
      const paymentLink = await this.fastify.paymentLinkRepository.createPaymentLink(
        {
          id,
          livemode,
          isActive: true,
          mode: payload.mode ?? CheckoutSessionModeEnum.PAYMENT,
          currency,
          url: this.fastify.hostedUrlFactory.buildPaymentLinkUrl(id),
          successUrl: payload.successUrl,
          metadata: payload.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        },
        tx,
      );

      if (!paymentLink) {
        throw new NotFoundError(`Payment link ${id} could not be created`);
      }

      await this.fastify.paymentLinkRepository.createPaymentLinkLineItems(lineItems, tx);
      await this.recordPaymentLinkEvent(paymentLink, DomainEventTypeEnum.PAYMENT_LINK_CREATED, tx);

      return paymentLink;
    });

    return this.buildPaymentLink(createdPaymentLink);
  }

  async updatePaymentLink(
    id: string,
    payload: UpdatePaymentLinkPayload,
    livemode: boolean,
  ): Promise<PaymentLinkResponse> {
    const paymentLink = await this.getPaymentLinkEntity(id, livemode);
    const now = this.fastify.clock.now();

    const updatedPaymentLink = await this.fastify.database.master.transaction(async (tx) => {
      const revisedPaymentLink = await this.fastify.paymentLinkRepository.updatePaymentLink(
        paymentLink.id,
        {
          isActive: payload.isActive ?? paymentLink.isActive,
          successUrl: payload.successUrl ?? paymentLink.successUrl,
          metadata: { ...paymentLink.metadata, ...payload.metadata },
          updatedAt: now,
        },
        tx,
      );

      if (!revisedPaymentLink) {
        throw new NotFoundError(`No such payment link: ${id}`);
      }

      await this.recordPaymentLinkEvent(
        revisedPaymentLink,
        DomainEventTypeEnum.PAYMENT_LINK_UPDATED,
        tx,
      );

      return revisedPaymentLink;
    });

    return this.buildPaymentLink(updatedPaymentLink);
  }

  async getPaymentLink(id: string, livemode: boolean): Promise<PaymentLinkResponse> {
    const paymentLink = await this.getPaymentLinkEntity(id, livemode);

    return this.buildPaymentLink(paymentLink);
  }

  async findPaymentLinks(
    query: FindPaymentLinksQuery,
    livemode: boolean,
  ): Promise<ListResponse<PaymentLinkResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.paymentLinkRepository.findPaymentLinks(
      { livemode, isActive: query.isActive, beforeAt, afterAt },
      limit + 1,
    );
    const page = _.take(rows, limit);
    const lineItemsByPaymentLinkId = await this.resolveLineItems(_.map(page, 'id'));

    return {
      object: 'list',
      url: '/v1/payment_links',
      hasMore: rows.length > limit,
      data: _.map(page, (paymentLink) => {
        return PaymentLinkService.buildPaymentLinkWithLineItems(
          paymentLink,
          _.get(lineItemsByPaymentLinkId, paymentLink.id, []),
        );
      }),
    };
  }

  async getPaymentLinkEntity(id: string, livemode: boolean): Promise<PaymentLink> {
    const paymentLink = await this.fastify.paymentLinkRepository.findPaymentLink(id);

    if (paymentLink && paymentLink.livemode === livemode) {
      return paymentLink;
    }

    throw new NotFoundError(`No such payment link: ${id}`);
  }

  async getHostedPaymentLink(id: string, token: string): Promise<PaymentLinkResponse> {
    const isVerified = this.fastify.hostedUrlFactory.verifyToken(
      HostedResourceEnum.PAYMENT_LINK,
      id,
      token,
    );
    const paymentLink = await this.fastify.paymentLinkRepository.findPaymentLink(id);

    if (isVerified && paymentLink) {
      return this.buildPaymentLink(paymentLink);
    }

    throw new NotFoundError(`No such payment link: ${id}`);
  }

  private async recordPaymentLinkEvent(
    paymentLink: PaymentLink,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.PAYMENT_LINK,
          aggregateId: paymentLink.id,
          livemode: paymentLink.livemode,
          eventType,
          payload: {
            id: paymentLink.id,
            isActive: paymentLink.isActive,
            mode: paymentLink.mode,
            url: paymentLink.url,
          },
        },
      ],
      tx,
    );
  }

  private async resolveLineItems(
    paymentLinkIds: readonly string[],
  ): Promise<Record<string, PaymentLinkLineItem[]>> {
    const rows = await this.fastify.paymentLinkRepository.findPaymentLinkLineItems(paymentLinkIds);

    return _.groupBy(rows, 'paymentLinkId');
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const paymentLink = await this.fastify.paymentLinkRepository.findPaymentLink(id);

      if (paymentLink) {
        return { createdAt: paymentLink.createdAt, id: paymentLink.id };
      }

      throw new NotFoundError(`No such payment link: ${id}`);
    }

    return undefined;
  }

  private async buildPaymentLink(paymentLink: PaymentLink): Promise<PaymentLinkResponse> {
    const lineItems = await this.fastify.paymentLinkRepository.findPaymentLinkLineItems([
      paymentLink.id,
    ]);

    return PaymentLinkService.buildPaymentLinkWithLineItems(paymentLink, lineItems);
  }

  private static buildPaymentLinkWithLineItems(
    entity: PaymentLink,
    lineItems: readonly PaymentLinkLineItem[],
  ): PaymentLinkResponse {
    return {
      object: 'payment_link',
      id: entity.id,
      livemode: entity.livemode,
      isActive: entity.isActive,
      mode: entity.mode,
      currency: entity.currency,
      url: entity.url,
      successUrl: entity.successUrl,
      lineItems: _.map(lineItems, (lineItem) => {
        return {
          object: 'payment_link.line_item' as const,
          id: lineItem.id,
          priceId: lineItem.priceId,
          quantity: lineItem.quantity,
        };
      }),
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
