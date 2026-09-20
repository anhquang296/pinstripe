import { MILLISECONDS_PER_DAY } from '@constants/time';
import { CouponDurationEnum } from '@contracts/discounts.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import { BillingModeEnum } from '@contracts/subscriptions.types';
import { ConflictError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeSubscription } from './factories';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomerId(): Promise<string> {
  const customer = await fastify.customerService.createCustomer({
    name: 'Discount Buyer',
    currency: CurrencyEnum.VND,
  });

  return customer.id;
}

async function makePriceId(unitAmount: number): Promise<{ productId: string; priceId: string }> {
  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });

  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  return { productId: product.id, priceId: price.id };
}

async function makeTwoProductSubscription(unitAmount: number) {
  const customerId = await makeCustomerId();
  const coveredPlan = await makePriceId(unitAmount);
  const otherPlan = await makePriceId(unitAmount);

  const subscription = await fastify.subscriptionService.createSubscription({
    customerId,
    items: [{ priceId: coveredPlan.priceId }, { priceId: otherPlan.priceId }],
    billingMode: BillingModeEnum.ARREARS,
  });

  return { customerId, subscriptionId: subscription.id, coveredProductId: coveredPlan.productId };
}

async function billStandalone(customerId: string, amount: number): Promise<number> {
  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Consulting',
    amount,
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  return open.totalDiscountAmount;
}

it('writes a percent discount onto the line and into the invoice total', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'Twenty',
    percentOff: 20,
    duration: CouponDurationEnum.FOREVER,
  });

  await fastify.discountService.createDiscount({ couponId: coupon.id, customerId });
  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Consulting',
    amount: 500_000,
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  const [lineItem] = open.lineItems;

  expect(open.subtotal).toBe(500_000);
  expect(open.totalDiscountAmount).toBe(100_000);
  expect(open.total).toBe(400_000);
  expect(open.amountDue).toBe(400_000);
  expect(_.sumBy(_.get(lineItem, 'discountAmounts', []), 'amount')).toBe(100_000);
});

it('stacks two discounts sequentially on the running balance', async () => {
  const customerId = await makeCustomerId();

  const firstCoupon = await fastify.couponService.createCoupon({
    name: 'First',
    percentOff: 20,
    duration: CouponDurationEnum.FOREVER,
  });

  const secondCoupon = await fastify.couponService.createCoupon({
    name: 'Second',
    percentOff: 20,
    duration: CouponDurationEnum.FOREVER,
  });

  await fastify.discountService.createDiscount({ couponId: firstCoupon.id, customerId });
  await fastify.discountService.createDiscount({ couponId: secondCoupon.id, customerId });

  const totalDiscountAmount = await billStandalone(customerId, 1_000_000);

  expect(totalDiscountAmount).toBe(360_000);
});

it('caps a fixed amount discount at the amount still left on the invoice', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'Big',
    amountOff: 800_000,
    currency: CurrencyEnum.VND,
    duration: CouponDurationEnum.FOREVER,
  });

  await fastify.discountService.createDiscount({ couponId: coupon.id, customerId });

  const totalDiscountAmount = await billStandalone(customerId, 500_000);

  expect(totalDiscountAmount).toBe(500_000);
});

it('spends a once coupon on the first invoice and leaves the second alone', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'Welcome',
    percentOff: 50,
    duration: CouponDurationEnum.ONCE,
  });

  await fastify.discountService.createDiscount({ couponId: coupon.id, customerId });

  const firstDiscount = await billStandalone(customerId, 400_000);
  const secondDiscount = await billStandalone(customerId, 400_000);

  expect(firstDiscount).toBe(200_000);
  expect(secondDiscount).toBe(0);
});

it('leaves a line that is not discountable at its full amount', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'Half',
    percentOff: 50,
    duration: CouponDurationEnum.FOREVER,
  });

  await fastify.discountService.createDiscount({ couponId: coupon.id, customerId });
  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Discountable',
    amount: 200_000,
  });
  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Locked',
    amount: 200_000,
    discountable: false,
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.totalDiscountAmount).toBe(100_000);
  expect(open.total).toBe(300_000);
});

it('refuses a coupon that has run out of redemptions', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'Scarce',
    percentOff: 10,
    duration: CouponDurationEnum.FOREVER,
    maxRedemptions: 1,
  });

  await fastify.discountService.createDiscount({ couponId: coupon.id, customerId });

  const act = fastify.discountService.createDiscount({ couponId: coupon.id, customerId });

  await expect(act).rejects.toThrow(ConflictError);
});

it('redeems a promotion code and records it on the discount', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'Coded',
    percentOff: 25,
    duration: CouponDurationEnum.FOREVER,
  });

  const promotionCode = await fastify.promotionCodeService.createPromotionCode({
    couponId: coupon.id,
    code: 'SPRING25',
  });

  const discount = await fastify.discountService.createDiscount({
    promotionCode: 'spring25',
    customerId,
  });

  const redeemed = await fastify.promotionCodeService.getPromotionCode(promotionCode.id);

  expect(discount.promotionCodeId).toBe(promotionCode.id);
  expect(redeemed.timesRedeemed).toBe(1);
});

it('skips a discount whose promotion code asks for a higher minimum amount', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'Bulk',
    percentOff: 30,
    duration: CouponDurationEnum.FOREVER,
  });

  await fastify.promotionCodeService.createPromotionCode({
    couponId: coupon.id,
    code: 'BULK30',
    minimumAmount: 1_000_000,
  });
  await fastify.discountService.createDiscount({ promotionCode: 'BULK30', customerId });

  const totalDiscountAmount = await billStandalone(customerId, 500_000);

  expect(totalDiscountAmount).toBe(0);
});

it('discounts three subscription invoices with a three month coupon and leaves the fourth full', async () => {
  const fixture = await makeSubscription(fastify, {
    unitAmount: 1_000_000,
    billingMode: BillingModeEnum.ARREARS,
  });

  const coupon = await fastify.couponService.createCoupon({
    name: 'Three months',
    percentOff: 20,
    duration: CouponDurationEnum.REPEATING,
    durationInMonths: 3,
  });

  await fastify.discountService.createDiscount({
    couponId: coupon.id,
    subscriptionId: fixture.subscriptionId,
  });

  const discountedTotals: number[] = [];

  for (const cycle of _.range(4)) {
    const draft = await fastify.invoiceService.createInvoice({
      subscriptionId: fixture.subscriptionId,
    });

    const open = await fastify.invoiceService.finalizeInvoice(draft.id);

    discountedTotals.push(open.totalDiscountAmount);

    if (cycle < 3) {
      await fastify.testClockService.advanceTestClock(fixture.testClockId, {
        frozenTime: new Date(Date.parse(open.periodEnd) + 1_000).toISOString(),
      });
    }
  }

  expect(discountedTotals).toEqual([200_000, 200_000, 200_000, 0]);
});

it('discounts only the line whose product the coupon applies to', async () => {
  const fixture = await makeTwoProductSubscription(1_000_000);

  const coupon = await fastify.couponService.createCoupon({
    name: 'One plan only',
    percentOff: 20,
    duration: CouponDurationEnum.FOREVER,
    appliesToProductIds: [fixture.coveredProductId],
  });

  await fastify.discountService.createDiscount({
    couponId: coupon.id,
    subscriptionId: fixture.subscriptionId,
  });

  const draft = await fastify.invoiceService.createInvoice({
    subscriptionId: fixture.subscriptionId,
  });

  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.subtotal).toBe(2_000_000);
  expect(open.totalDiscountAmount).toBe(200_000);
});

it('refuses a coupon that is past its redeem by date', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'Expired',
    percentOff: 15,
    duration: CouponDurationEnum.FOREVER,
    redeemBy: new Date(Date.now() - MILLISECONDS_PER_DAY).toISOString(),
  });

  const act = fastify.discountService.createDiscount({ couponId: coupon.id, customerId });

  await expect(act).rejects.toThrow(ConflictError);
});

it('refuses a first time transaction promotion code for a customer who has already paid', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'Newcomer',
    percentOff: 15,
    duration: CouponDurationEnum.FOREVER,
  });

  await fastify.promotionCodeService.createPromotionCode({
    couponId: coupon.id,
    code: 'NEWCOMER15',
    firstTimeTransaction: true,
  });
  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Consulting',
    amount: 300_000,
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  await fastify.invoiceService.payInvoice(open.id, {});

  const act = fastify.discountService.createDiscount({ promotionCode: 'NEWCOMER15', customerId });

  await expect(act).rejects.toThrow(ConflictError);
});

it('keeps an invoice item discount on its own line', async () => {
  const customerId = await makeCustomerId();

  const coupon = await fastify.couponService.createCoupon({
    name: 'One line',
    percentOff: 50,
    duration: CouponDurationEnum.FOREVER,
  });

  const discountedItem = await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Discounted',
    amount: 400_000,
  });

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Untouched',
    amount: 400_000,
  });
  await fastify.discountService.createDiscount({
    couponId: coupon.id,
    invoiceItemId: discountedItem.id,
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.totalDiscountAmount).toBe(200_000);
  expect(open.total).toBe(600_000);
});

it('reports MRR net of an active subscription discount', async () => {
  const fixture = await makeSubscription(fastify, { unitAmount: 2_000_000 });

  const coupon = await fastify.couponService.createCoupon({
    name: 'Mrr',
    percentOff: 25,
    duration: CouponDurationEnum.FOREVER,
  });

  const before = await fastify.reportingService.aggregateRevenueSummary({});

  await fastify.discountService.createDiscount({
    couponId: coupon.id,
    subscriptionId: fixture.subscriptionId,
  });

  const after = await fastify.reportingService.aggregateRevenueSummary({});

  expect(before.mrr - after.mrr).toBe(500_000);
});
