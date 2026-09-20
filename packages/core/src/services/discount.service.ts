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
  startAt: string | null;
  level: DiscountLevelEnum;
  subscriptionId: string | null;
  subscriptionItemId: string | null;
  invoiceId: string | null;
  invoiceItemId: string | null;
}

export class DiscountService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createDiscount(payload: CreateDiscountPayload): Promise<DiscountResponse> {
    const target = await this.resolveTarget(payload);

    const { coupon, promotionCodeId } = await this.redeemCoupon(payload, target);

    const now = this.fastify.clock.now().toISOString();

    const { startAt: targetStartAt } = target;

    const startAt = targetStartAt === null ? now : targetStartAt;
    const id = generateGid(ObjectPrefixEnum.DISCOUNT);

    const { metadata = {} } = payload;

    return this.fastify.database.master.transaction(async (tx) => {
      const discount = await this.fastify.discountRepository.createDiscount(
        {
          id,
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
          metadata,
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
  }

  private static resolveEndAt(coupon: Coupon, startAt: string): string | null {
    const { duration, durationInMonths } = coupon;

    if (duration === CouponDurationEnum.REPEATING && durationInMonths !== null) {
      const endAt = advancePeriod(new Date(startAt), RecurringIntervalEnum.MONTH, durationInMonths);

      return endAt.toISOString();
    }

    return null;
  }

  private async resolveTarget(payload: CreateDiscountPayload): Promise<DiscountTarget> {
    const { invoiceItemId, invoiceId, subscriptionItemId, subscriptionId, customerId } = payload;

    if (invoiceItemId) {
      const invoiceItem = await this.fastify.invoiceItemService.getInvoiceItem(invoiceItemId);

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
      const invoice = await this.fastify.invoiceService.getInvoice(invoiceId);

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
      return this.resolveSubscriptionItemTarget(subscriptionItemId);
    }

    if (subscriptionId) {
      const subscription = await this.fastify.subscriptionService.getSubscription(subscriptionId);

      return {
        customerId: subscription.customerId,
        startAt: subscription.currentPeriodStart,
        level: DiscountLevelEnum.SUBSCRIPTION,
        subscriptionId,
        subscriptionItemId: null,
        invoiceId: null,
        invoiceItemId: null,
      };
    }

    if (customerId) {
      const customer = await this.fastify.customerService.getCustomer(customerId);

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

  private async resolveSubscriptionItemTarget(subscriptionItemId: string): Promise<DiscountTarget> {
    const subscriptionItem =
      await this.fastify.subscriptionRepository.getSubscriptionItem(subscriptionItemId);

    const subscription = await this.fastify.subscriptionService.getSubscription(
      subscriptionItem.subscriptionId,
    );

    return {
      customerId: subscription.customerId,
      startAt: subscription.currentPeriodStart,
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
  ): Promise<{ coupon: Coupon; promotionCodeId: string | null }> {
    const now = this.fastify.clock.now();

    const { promotionCode: code, couponId } = payload;

    if (code) {
      const promotionCode = await this.fastify.promotionCodeService.resolvePromotionCode(code);

      const redeemedPromotionCode = await this.fastify.promotionCodeService.redeemPromotionCode(
        promotionCode,
        target.customerId,
        now,
      );

      const coupon = await this.redeemCouponEntity(redeemedPromotionCode.couponId, now);

      return { coupon, promotionCodeId: redeemedPromotionCode.id };
    }

    if (couponId) {
      const coupon = await this.redeemCouponEntity(couponId, now);

      return { coupon, promotionCodeId: null };
    }

    throw new BadRequestError('A discount needs a coupon or a promotion code', {
      param: 'couponId',
    });
  }

  private async redeemCouponEntity(couponId: string, now: Date): Promise<Coupon> {
    const coupon = await this.fastify.couponRepository.getCoupon(couponId);

    const { redeemBy } = coupon;

    if (redeemBy && new Date(redeemBy).getTime() <= now.getTime()) {
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
    activeAt: string,
  ): Promise<Discount[]> {
    const discounts = await this.fastify.discountRepository.findDiscounts({
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

        const { priceId } = line;

        const productId = priceId === null ? '' : _.get(productIdByPriceId, priceId, '');

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

    const fixedAmountOff = amountOff ?? 0;

    return Math.min(fixedAmountOff, base);
  }

  private async closeOnceDiscount(
    discount: Discount,
    coupon: Coupon,
    activeAt: string,
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

  async getDiscount(id: string): Promise<DiscountResponse> {
    return this.fastify.discountRepository.getDiscount(id);
  }

  async updateDiscount(id: string, payload: UpdateDiscountPayload): Promise<DiscountResponse> {
    const existingDiscount = await this.fastify.discountRepository.getDiscount(id);
    const updatedAt = this.fastify.clock.now().toISOString();

    const { metadata = existingDiscount.metadata } = payload;

    return this.fastify.database.master.transaction(async (tx) => {
      const discount = await this.fastify.discountRepository.updateDiscount(
        id,
        { metadata, updatedAt },
        tx,
      );

      if (discount) {
        await this.recordDiscountEvent(discount, DomainEventTypeEnum.CUSTOMER_DISCOUNT_UPDATED, tx);

        return discount;
      }

      throw new NotFoundError(`No such discount: ${id}`);
    });
  }

  async deleteDiscount(id: string): Promise<DeletedDiscountResponse> {
    const discount = await this.fastify.discountRepository.getDiscount(id);
    const deletedAt = this.fastify.clock.now().toISOString();

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.discountRepository.archiveDiscount(id, deletedAt, tx);
      await this.recordDiscountEvent(discount, DomainEventTypeEnum.CUSTOMER_DISCOUNT_DELETED, tx);
    });

    return { id, deleted: true };
  }

  async findDiscounts(query: FindDiscountsQuery): Promise<ListResponse<DiscountResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.discountRepository.findDiscounts(
      {
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
      url: '/v1/discounts',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const discount = await this.fastify.discountRepository.getDiscount(id);

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
}
