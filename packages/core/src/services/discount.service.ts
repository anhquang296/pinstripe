import type {
  CreateDiscountPayload,
  DeletedDiscountResponse,
  DiscountResponse,
  FindDiscountsQuery,
  UpdateDiscountPayload,
} from '@contracts/discounts.types';
import { CouponDurationEnum, DiscountLevelEnum } from '@contracts/discounts.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Coupon, Discount, Invoice } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import type { InvoiceDraftLine } from '@services/invoice.service';
import { advancePeriod } from '@utils/billing-period';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { RoundingPolicy } from '@utils/money';
import { Money, RoundingPolicyEnum } from '@utils/money';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DISCOUNT_ROUNDING_POLICY: RoundingPolicy = RoundingPolicyEnum.HALF_UP;
const PERCENT_DIVISOR = 100;

interface DiscountTarget {
  customerId: string;
  startAt: Date | null;
  level: DiscountLevelEnum;
  subscriptionId: string | null;
  subscriptionItemId: string | null;
  invoiceId: string | null;
  invoiceItemId: string | null;
}

export class DiscountService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createDiscount(
    payload: CreateDiscountPayload,
    livemode: boolean,
  ): Promise<DiscountResponse> {
    const target = await this.resolveTarget(payload, livemode);
    const { coupon, promotionCodeId } = await this.redeemCoupon(payload, target, livemode);

    const now = this.fastify.clock.now();
    const startAt = target.startAt ?? now;
    const id = generateGid(ObjectPrefixEnum.DISCOUNT);

    const createdDiscount = await this.fastify.database.master.transaction(async (tx) => {
      const discount = await this.fastify.discountRepository.createDiscount(
        {
          id,
          livemode,
          couponId: coupon.id,
          promotionCodeId,
          customerId: target.customerId,
          level: target.level,
          subscriptionId: target.subscriptionId,
          subscriptionItemId: target.subscriptionItemId,
          invoiceId: target.invoiceId,
          invoiceItemId: target.invoiceItemId,
          startAt,
          endAt: DiscountService.resolveEndAt(coupon, startAt),
          metadata: payload.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        },
        tx,
      );

      if (discount) {
        await this.recordDiscountEvent(discount, DomainEventTypeEnum.CUSTOMER_DISCOUNT_CREATED, tx);

        return discount;
      }

      throw new NotFoundError(`Discount ${id} could not be created`);
    });

    return DiscountService.buildDiscount(createdDiscount);
  }

  private static resolveEndAt(coupon: Coupon, startAt: Date): Date | null {
    const { duration, durationInMonths } = coupon;

    if (duration === CouponDurationEnum.REPEATING && durationInMonths !== null) {
      return advancePeriod(startAt, RecurringIntervalEnum.MONTH, durationInMonths);
    }

    return null;
  }

  private async resolveTarget(
    payload: CreateDiscountPayload,
    livemode: boolean,
  ): Promise<DiscountTarget> {
    const { invoiceItemId, invoiceId, subscriptionItemId, subscriptionId, customerId } = payload;

    if (invoiceItemId) {
      const invoiceItem = await this.fastify.invoiceItemService.getInvoiceItem(
        invoiceItemId,
        livemode,
      );

      return {
        customerId: invoiceItem.customerId,
        startAt: null,
        level: DiscountLevelEnum.INVOICE_ITEM,
        subscriptionId: null,
        subscriptionItemId: null,
        invoiceId: null,
        invoiceItemId,
      };
    }

    if (invoiceId) {
      const invoice = await this.fastify.invoiceService.getInvoice(invoiceId, livemode);

      return {
        customerId: invoice.customerId,
        startAt: null,
        level: DiscountLevelEnum.INVOICE,
        subscriptionId: null,
        subscriptionItemId: null,
        invoiceId,
        invoiceItemId: null,
      };
    }

    if (subscriptionItemId) {
      return this.resolveSubscriptionItemTarget(subscriptionItemId, livemode);
    }

    if (subscriptionId) {
      const subscription = await this.fastify.subscriptionService.getSubscription(
        subscriptionId,
        livemode,
      );

      return {
        customerId: subscription.customerId,
        startAt: new Date(subscription.currentPeriodStart),
        level: DiscountLevelEnum.SUBSCRIPTION,
        subscriptionId,
        subscriptionItemId: null,
        invoiceId: null,
        invoiceItemId: null,
      };
    }

    if (customerId) {
      const customer = await this.fastify.customerService.getCustomer(customerId, livemode);

      return {
        customerId: customer.id,
        startAt: null,
        level: DiscountLevelEnum.CUSTOMER,
        subscriptionId: null,
        subscriptionItemId: null,
        invoiceId: null,
        invoiceItemId: null,
      };
    }

    throw new BadRequestError('A discount needs something to apply to', { param: 'customerId' });
  }

  private async resolveSubscriptionItemTarget(
    subscriptionItemId: string,
    livemode: boolean,
  ): Promise<DiscountTarget> {
    const [subscriptionItem] = await this.fastify.subscriptionRepository.findSubscriptionItems({
      ids: [subscriptionItemId],
    });

    if (!subscriptionItem) {
      throw new NotFoundError(`No such subscription item: ${subscriptionItemId}`);
    }

    const subscription = await this.fastify.subscriptionService.getSubscription(
      subscriptionItem.subscriptionId,
      livemode,
    );

    return {
      customerId: subscription.customerId,
      startAt: new Date(subscription.currentPeriodStart),
      level: DiscountLevelEnum.SUBSCRIPTION_ITEM,
      subscriptionId: subscription.id,
      subscriptionItemId,
      invoiceId: null,
      invoiceItemId: null,
    };
  }

  private async redeemCoupon(
    payload: CreateDiscountPayload,
    target: DiscountTarget,
    livemode: boolean,
  ): Promise<{ coupon: Coupon; promotionCodeId: string | null }> {
    const now = this.fastify.clock.now();
    const { promotionCode: code, couponId } = payload;

    if (code) {
      const promotionCode = await this.fastify.promotionCodeService.resolvePromotionCode(
        code,
        livemode,
      );

      const redeemedPromotionCode = await this.fastify.promotionCodeService.redeemPromotionCode(
        promotionCode,
        target.customerId,
        now,
      );
      const coupon = await this.redeemCouponEntity(redeemedPromotionCode.couponId, now, livemode);

      return { coupon, promotionCodeId: redeemedPromotionCode.id };
    }

    if (couponId) {
      const coupon = await this.redeemCouponEntity(couponId, now, livemode);

      return { coupon, promotionCodeId: null };
    }

    throw new BadRequestError('A discount needs a coupon or a promotion code', {
      param: 'couponId',
    });
  }

  private async redeemCouponEntity(
    couponId: string,
    now: Date,
    livemode: boolean,
  ): Promise<Coupon> {
    const coupon = await this.fastify.couponService.getCouponEntity(couponId, livemode);
    const { redeemBy } = coupon;

    if (redeemBy && redeemBy.getTime() <= now.getTime()) {
      throw new ConflictError(`Coupon ${couponId} is past its redeem by date`);
    }

    const redeemedCoupon = await this.fastify.couponRepository.redeemCoupon(couponId);

    if (redeemedCoupon) {
      return redeemedCoupon;
    }

    throw new ConflictError(`Coupon ${couponId} has run out of redemptions`);
  }

  async applyDiscounts(
    invoice: Invoice,
    lines: readonly InvoiceDraftLine[],
    tx: DatabaseTransaction,
  ): Promise<InvoiceDraftLine[]> {
    const discountedLines = _.map(lines, (line) => {
      return { ...line, discountAmounts: [...line.discountAmounts] };
    });

    if (_.isEmpty(discountedLines)) {
      return discountedLines;
    }

    const activeAt = invoice.periodStart;
    const discounts = await this.findApplicableDiscounts(invoice, discountedLines, activeAt);

    if (_.isEmpty(discounts)) {
      return discountedLines;
    }

    const couponById = await this.resolveCoupons(_.map(discounts, 'couponId'));
    const productIdByPriceId = await this.resolveProductIds(discountedLines);
    const subtotal = _.sumBy(discountedLines, 'amount');

    for (const discount of discounts) {
      const coupon = couponById[discount.couponId];

      if (coupon && (await this.isDiscountUsable(discount, coupon, invoice, subtotal))) {
        DiscountService.writeDiscountAmounts(
          discount,
          coupon,
          discountedLines,
          productIdByPriceId,
          invoice,
        );

        await this.closeOnceDiscount(discount, coupon, activeAt, tx);
      }
    }

    return discountedLines;
  }

  private async findApplicableDiscounts(
    invoice: Invoice,
    lines: readonly InvoiceDraftLine[],
    activeAt: Date,
  ): Promise<Discount[]> {
    const discounts = await this.fastify.discountRepository.findDiscounts({
      livemode: invoice.livemode,
      customerId: invoice.customerId,
      activeAt,
    });

    const subscriptionItemIds = _.compact(_.map(lines, 'subscriptionItemId'));
    const invoiceItemIds = _.compact(_.map(lines, 'invoiceItemId'));

    return _.filter(discounts, (discount) => {
      if (discount.level === DiscountLevelEnum.CUSTOMER) {
        return true;
      }

      if (discount.level === DiscountLevelEnum.INVOICE) {
        return discount.invoiceId === invoice.id;
      }

      if (discount.level === DiscountLevelEnum.INVOICE_ITEM) {
        return _.includes(invoiceItemIds, discount.invoiceItemId);
      }

      if (discount.level === DiscountLevelEnum.SUBSCRIPTION_ITEM) {
        return _.includes(subscriptionItemIds, discount.subscriptionItemId);
      }

      return Boolean(invoice.subscriptionId) && discount.subscriptionId === invoice.subscriptionId;
    });
  }

  private async isDiscountUsable(
    discount: Discount,
    coupon: Coupon,
    invoice: Invoice,
    subtotal: number,
  ): Promise<boolean> {
    if (!coupon.valid) {
      return false;
    }

    if (coupon.amountOff !== null && coupon.currency !== invoice.currency) {
      this.fastify.log.warn(
        { discountId: discount.id, couponId: coupon.id, invoiceId: invoice.id },
        '[DiscountService] isDiscountUsable() skipped, coupon currency does not match the invoice',
      );

      return false;
    }

    const { promotionCodeId } = discount;

    if (!promotionCodeId) {
      return true;
    }

    const promotionCode =
      await this.fastify.promotionCodeRepository.findPromotionCode(promotionCodeId);
    const minimumAmount = _.get(promotionCode, 'minimumAmount', null);

    return minimumAmount === null || subtotal >= minimumAmount;
  }

  private static writeDiscountAmounts(
    discount: Discount,
    coupon: Coupon,
    lines: InvoiceDraftLine[],
    productIdByPriceId: Record<string, string>,
    invoice: Invoice,
  ): void {
    const eligibleIndexes = DiscountService.resolveEligibleIndexes(
      discount,
      coupon,
      lines,
      productIdByPriceId,
    );
    const remainders = _.map(eligibleIndexes, (index) => {
      return DiscountService.readRemainder(lines[index]);
    });
    const base = _.sum(remainders);

    if (base <= 0) {
      return;
    }

    const amount = DiscountService.resolveDiscountAmount(coupon, base, invoice);

    if (amount <= 0) {
      return;
    }

    const shares = Money.of(amount, invoice.currency).allocate(remainders);

    _.forEach(eligibleIndexes, (lineIndex, shareIndex) => {
      const share = shares[shareIndex];
      const line = lines[lineIndex];

      if (line && share && share.isPositive()) {
        line.discountAmounts = [
          ...line.discountAmounts,
          { discountId: discount.id, amount: share.amount },
        ];
      }
    });
  }

  private static resolveEligibleIndexes(
    discount: Discount,
    coupon: Coupon,
    lines: readonly InvoiceDraftLine[],
    productIdByPriceId: Record<string, string>,
  ): number[] {
    const productIds = coupon.appliesToProductIds;

    return _(lines)
      .map((line, index) => {
        return { line, index };
      })
      .filter(({ line }) => {
        if (!line.discountable || DiscountService.readRemainder(line) <= 0) {
          return false;
        }

        if (discount.level === DiscountLevelEnum.SUBSCRIPTION_ITEM) {
          return line.subscriptionItemId === discount.subscriptionItemId;
        }

        if (discount.level === DiscountLevelEnum.INVOICE_ITEM) {
          return line.invoiceItemId === discount.invoiceItemId;
        }

        if (_.isEmpty(productIds)) {
          return true;
        }

        const productId = _.get(productIdByPriceId, line.priceId ?? '', '');

        return _.includes(productIds, productId);
      })
      .map('index')
      .value();
  }

  private static readRemainder(line: InvoiceDraftLine | undefined): number {
    if (!line) {
      return 0;
    }

    return line.amount - _.sumBy(line.discountAmounts, 'amount');
  }

  private static resolveDiscountAmount(coupon: Coupon, base: number, invoice: Invoice): number {
    const { percentOff, amountOff } = coupon;

    if (percentOff !== null) {
      return Money.of(base, invoice.currency).multiply(
        percentOff / PERCENT_DIVISOR,
        DISCOUNT_ROUNDING_POLICY,
      ).amount;
    }

    return Math.min(amountOff ?? 0, base);
  }

  private async closeOnceDiscount(
    discount: Discount,
    coupon: Coupon,
    activeAt: Date,
    tx: DatabaseTransaction,
  ): Promise<void> {
    if (coupon.duration !== CouponDurationEnum.ONCE) {
      return;
    }

    const closedDiscount = await this.fastify.discountRepository.updateDiscount(
      discount.id,
      { endAt: activeAt, updatedAt: activeAt },
      tx,
    );

    if (closedDiscount) {
      await this.recordDiscountEvent(
        closedDiscount,
        DomainEventTypeEnum.CUSTOMER_DISCOUNT_UPDATED,
        tx,
      );
    }
  }

  private async resolveCoupons(couponIds: readonly string[]): Promise<Record<string, Coupon>> {
    const coupons = await Promise.all(
      _.map(_.uniq([...couponIds]), (couponId) => {
        return this.fastify.couponRepository.findCoupon(couponId);
      }),
    );

    return _.keyBy(_.compact(coupons), 'id');
  }

  private async resolveProductIds(
    lines: readonly InvoiceDraftLine[],
  ): Promise<Record<string, string>> {
    const priceIds = _.uniq(_.compact(_.map(lines, 'priceId')));

    if (_.isEmpty(priceIds)) {
      return {};
    }

    const prices = await this.fastify.priceRepository.findPrices(
      { ids: priceIds },
      priceIds.length,
    );

    return _.mapValues(_.keyBy(prices, 'id'), 'productId');
  }

  async getDiscount(id: string, livemode: boolean): Promise<DiscountResponse> {
    const discount = await this.getDiscountEntity(id, livemode);

    return DiscountService.buildDiscount(discount);
  }

  private async getDiscountEntity(id: string, livemode: boolean): Promise<Discount> {
    const discount = await this.fastify.discountRepository.findDiscount(id);

    if (discount && discount.livemode === livemode) {
      return discount;
    }

    throw new NotFoundError(`No such discount: ${id}`);
  }

  async updateDiscount(
    id: string,
    payload: UpdateDiscountPayload,
    livemode: boolean,
  ): Promise<DiscountResponse> {
    const existingDiscount = await this.getDiscountEntity(id, livemode);
    const now = this.fastify.clock.now();

    const updatedDiscount = await this.fastify.database.master.transaction(async (tx) => {
      const discount = await this.fastify.discountRepository.updateDiscount(
        id,
        { metadata: payload.metadata ?? existingDiscount.metadata, updatedAt: now },
        tx,
      );

      if (discount) {
        await this.recordDiscountEvent(discount, DomainEventTypeEnum.CUSTOMER_DISCOUNT_UPDATED, tx);

        return discount;
      }

      throw new NotFoundError(`No such discount: ${id}`);
    });

    return DiscountService.buildDiscount(updatedDiscount);
  }

  async deleteDiscount(id: string, livemode: boolean): Promise<DeletedDiscountResponse> {
    const discount = await this.getDiscountEntity(id, livemode);
    const now = this.fastify.clock.now();

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.discountRepository.archiveDiscount(id, now, tx);
      await this.recordDiscountEvent(discount, DomainEventTypeEnum.CUSTOMER_DISCOUNT_DELETED, tx);
    });

    return { object: 'discount', id, deleted: true };
  }

  async findDiscounts(
    query: FindDiscountsQuery,
    livemode: boolean,
  ): Promise<ListResponse<DiscountResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter, livemode);
    const afterAt = await this.resolveCursor(query.endingBefore, livemode);

    const rows = await this.fastify.discountRepository.findDiscounts(
      {
        livemode,
        customerId: query.customerId,
        subscriptionId: query.subscriptionId,
        invoiceId: query.invoiceId,
        couponId: query.couponId,
        level: query.level,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/discounts',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(DiscountService.buildDiscount).value(),
    };
  }

  private async resolveCursor(
    id: string | undefined,
    livemode: boolean,
  ): Promise<RowCursor | undefined> {
    if (id) {
      const discount = await this.getDiscountEntity(id, livemode);

      return { createdAt: discount.createdAt, id: discount.id };
    }

    return undefined;
  }

  private async recordDiscountEvent(
    discount: Discount,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.DISCOUNT,
          aggregateId: discount.id,
          livemode: discount.livemode,
          eventType,
          payload: {
            id: discount.id,
            customerId: discount.customerId,
            couponId: discount.couponId,
            level: discount.level,
          },
        },
      ],
      tx,
    );
  }

  static buildDiscount(entity: Discount): DiscountResponse {
    return {
      object: 'discount',
      id: entity.id,
      livemode: entity.livemode,
      couponId: entity.couponId,
      promotionCodeId: entity.promotionCodeId,
      customerId: entity.customerId,
      level: entity.level,
      subscriptionId: entity.subscriptionId,
      subscriptionItemId: entity.subscriptionItemId,
      invoiceId: entity.invoiceId,
      invoiceItemId: entity.invoiceItemId,
      startAt: entity.startAt.toISOString(),
      endAt: entity.endAt ? entity.endAt.toISOString() : null,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
