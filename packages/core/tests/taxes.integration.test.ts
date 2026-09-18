import { CouponDurationEnum } from '@contracts/discounts.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import { RecurringIntervalEnum, TaxBehaviorEnum } from '@contracts/prices.types';
import { BillingModeEnum } from '@contracts/subscriptions.types';
import {
  AuthorityStatusEnum,
  AutomaticTaxStatusEnum,
  TaxExemptEnum,
  TaxIdTypeEnum,
  TaxIdVerificationStatusEnum,
  TaxTypeEnum,
} from '@contracts/taxes.types';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildTestContext } from './context';
const VIETNAM = 'VN';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

interface TaxRateOverrides {
  percentage?: number;
  inclusive?: boolean;
  country?: string;
  state?: string;
}

async function makeTaxRate(overrides: TaxRateOverrides = {}): Promise<string> {
  const { percentage = 10, inclusive = true, country, state } = overrides;
  const taxRate = await fastify.taxRateService.createTaxRate({
    displayName: `VAT ${percentage}`,
    percentage,
    inclusive,
    taxType: TaxTypeEnum.VAT,
    jurisdiction: country ?? 'internal',
    country,
    state,
  });

  return taxRate.id;
}

interface CustomerOverrides {
  currency?: Currency;
  country?: string;
  taxExempt?: TaxExemptEnum;
}

async function makeCustomerId(overrides: CustomerOverrides = {}): Promise<string> {
  const { currency = CurrencyEnum.VND, country, taxExempt } = overrides;
  const customer = await fastify.customerService.createCustomer({
    name: 'Tax Buyer',
    currency,
    taxExempt,
    address: country ? { country } : undefined,
  });

  return customer.id;
}

async function readAccountBalance(
  code: LedgerAccountCodeEnum,
  currency: Currency,
): Promise<number> {
  const account = await fastify.ledgerService.ensureAccount(code, currency);

  return account.balance;
}

it('carves an inclusive VND tax out of the line and credits tax payable', async () => {
  const taxRateId = await makeTaxRate({ percentage: 10, inclusive: true });
  const customerId = await makeCustomerId();
  const taxPayableBefore = await readAccountBalance(
    LedgerAccountCodeEnum.TAX_PAYABLE,
    CurrencyEnum.VND,
  );

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Hosting',
    amount: 1_100_000,
    taxRates: [taxRateId],
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);
  const [lineItem] = open.lineItems;
  const taxPayableAfter = await readAccountBalance(
    LedgerAccountCodeEnum.TAX_PAYABLE,
    CurrencyEnum.VND,
  );
  const receivable = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    CurrencyEnum.VND,
    customerId,
  );

  expect(open.subtotal).toBe(1_100_000);
  expect(open.subtotalExcludingTax).toBe(1_000_000);
  expect(open.totalTaxAmount).toBe(100_000);
  expect(open.total).toBe(1_100_000);
  expect(open.amountDue).toBe(1_100_000);
  expect(_.get(lineItem, 'amountExcludingTax')).toBe(1_000_000);
  expect(_.get(lineItem, 'taxAmounts.0')).toMatchObject({
    taxRateId,
    amount: 100_000,
    taxableAmount: 1_100_000,
    isInclusive: true,
    percentage: 10,
    taxType: TaxTypeEnum.VAT,
  });
  expect(taxPayableAfter - taxPayableBefore).toBe(100_000);
  expect(receivable.balance).toBe(1_100_000);
});

it('adds an exclusive USD tax on top of the line and credits tax payable', async () => {
  const taxRateId = await makeTaxRate({ percentage: 8.5, inclusive: false });
  const customerId = await makeCustomerId({ currency: CurrencyEnum.USD });
  const taxPayableBefore = await readAccountBalance(
    LedgerAccountCodeEnum.TAX_PAYABLE,
    CurrencyEnum.USD,
  );

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Seats',
    amount: 120_000,
    taxRates: [taxRateId],
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);
  const taxPayableAfter = await readAccountBalance(
    LedgerAccountCodeEnum.TAX_PAYABLE,
    CurrencyEnum.USD,
  );
  const receivable = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    CurrencyEnum.USD,
    customerId,
  );

  expect(open.subtotal).toBe(120_000);
  expect(open.subtotalExcludingTax).toBe(120_000);
  expect(open.totalTaxAmount).toBe(10_200);
  expect(open.total).toBe(130_200);
  expect(open.amountDue).toBe(130_200);
  expect(taxPayableAfter - taxPayableBefore).toBe(10_200);
  expect(receivable.balance).toBe(130_200);
});

it('reverses both the receivable and the tax payable when an inclusive invoice is voided', async () => {
  const taxRateId = await makeTaxRate({ percentage: 10, inclusive: true });
  const customerId = await makeCustomerId();
  const taxPayableBefore = await readAccountBalance(
    LedgerAccountCodeEnum.TAX_PAYABLE,
    CurrencyEnum.VND,
  );

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Hosting',
    amount: 1_100_000,
    taxRates: [taxRateId],
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  await fastify.invoiceService.voidInvoice(open.id, {});

  const taxPayableAfter = await readAccountBalance(
    LedgerAccountCodeEnum.TAX_PAYABLE,
    CurrencyEnum.VND,
  );
  const receivable = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    CurrencyEnum.VND,
    customerId,
  );

  expect(taxPayableAfter).toBe(taxPayableBefore);
  expect(receivable.balance).toBe(0);
});

it('reverses both sides when an exclusive USD invoice is voided', async () => {
  const taxRateId = await makeTaxRate({ percentage: 8.5, inclusive: false });
  const customerId = await makeCustomerId({ currency: CurrencyEnum.USD });
  const taxPayableBefore = await readAccountBalance(
    LedgerAccountCodeEnum.TAX_PAYABLE,
    CurrencyEnum.USD,
  );

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Seats',
    amount: 120_000,
    taxRates: [taxRateId],
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  await fastify.invoiceService.voidInvoice(open.id, {});

  const taxPayableAfter = await readAccountBalance(
    LedgerAccountCodeEnum.TAX_PAYABLE,
    CurrencyEnum.USD,
  );
  const receivable = await fastify.ledgerService.ensureAccount(
    LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
    CurrencyEnum.USD,
    customerId,
  );

  expect(taxPayableAfter).toBe(taxPayableBefore);
  expect(receivable.balance).toBe(0);
});

it('taxes the amount left after a discount, not the gross line', async () => {
  const taxRateId = await makeTaxRate({ percentage: 10, inclusive: false });
  const customerId = await makeCustomerId();
  const coupon = await fastify.couponService.createCoupon({
    name: 'Half',
    percentOff: 50,
    duration: CouponDurationEnum.FOREVER,
  });

  await fastify.discountService.createDiscount({ couponId: coupon.id, customerId });
  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Hosting',
    amount: 1_000_000,
    taxRates: [taxRateId],
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.totalDiscountAmount).toBe(500_000);
  expect(open.totalTaxAmount).toBe(50_000);
  expect(open.total).toBe(550_000);
});

it('collects nothing from a tax exempt customer', async () => {
  const taxRateId = await makeTaxRate({ percentage: 10, inclusive: false });
  const customerId = await makeCustomerId({ taxExempt: TaxExemptEnum.EXEMPT });

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Hosting',
    amount: 1_000_000,
    taxRates: [taxRateId],
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.totalTaxAmount).toBe(0);
  expect(open.total).toBe(1_000_000);
  expect(_.get(open.lineItems, '0.taxAmounts')).toEqual([]);
});

it('looks the rate up by country when automatic tax is enabled', async () => {
  await makeTaxRate({ percentage: 10, inclusive: true, country: VIETNAM });

  const customerId = await makeCustomerId({ country: VIETNAM });

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Hosting',
    amount: 1_100_000,
  });

  const draft = await fastify.invoiceService.createInvoice({
    customerId,
    automaticTax: { enabled: true },
  });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.automaticTax).toEqual({
    enabled: true,
    status: AutomaticTaxStatusEnum.COMPLETE,
  });
  expect(open.totalTaxAmount).toBe(100_000);
});

it('asks for a location when automatic tax is enabled and the customer has no address', async () => {
  await makeTaxRate({ percentage: 10, inclusive: true, country: VIETNAM });

  const customerId = await makeCustomerId();

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Hosting',
    amount: 1_100_000,
  });

  const draft = await fastify.invoiceService.createInvoice({
    customerId,
    automaticTax: { enabled: true },
  });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.automaticTax.status).toBe(AutomaticTaxStatusEnum.REQUIRES_LOCATION_INPUTS);
  expect(open.totalTaxAmount).toBe(0);
});

it('keeps the frozen rate snapshot on the line after the rate is deactivated', async () => {
  const taxRateId = await makeTaxRate({ percentage: 10, inclusive: false });
  const customerId = await makeCustomerId();

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    description: 'Hosting',
    amount: 1_000_000,
    taxRates: [taxRateId],
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  await fastify.taxRateService.updateTaxRate(taxRateId, { active: false });

  const reread = await fastify.invoiceService.getInvoice(open.id);

  expect(_.get(reread.lineItems, '0.taxAmounts.0.percentage')).toBe(10);
  expect(reread.totalTaxAmount).toBe(100_000);
  expect(reread.authorityInvoiceNumber).toBeNull();
  expect(reread.authorityStatus).toBe(AuthorityStatusEnum.NOT_SUBMITTED);
});

it('reads an inclusive price as tax inclusive even when the rate is exclusive', async () => {
  const taxRateId = await makeTaxRate({ percentage: 10, inclusive: false });
  const customerId = await makeCustomerId();
  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });
  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 1_100_000,
    taxBehavior: TaxBehaviorEnum.INCLUSIVE,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  await fastify.invoiceItemService.createInvoiceItem({
    customerId,
    priceId: price.id,
    description: 'Plan',
    taxRates: [taxRateId],
  });

  const draft = await fastify.invoiceService.createInvoice({ customerId });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.totalTaxAmount).toBe(100_000);
  expect(open.total).toBe(1_100_000);
  expect(_.get(open.lineItems, '0.taxAmounts.0.isInclusive')).toBe(true);
});

it('applies the default tax rates of a subscription to its cycle invoice', async () => {
  const taxRateId = await makeTaxRate({ percentage: 10, inclusive: false });
  const customerId = await makeCustomerId();
  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });
  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 2_000_000,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });
  const subscription = await fastify.subscriptionService.createSubscription({
    customerId,
    items: [{ priceId: price.id }],
    defaultTaxRates: [taxRateId],
    billingMode: BillingModeEnum.ARREARS,
  });

  const draft = await fastify.invoiceService.createInvoice({ subscriptionId: subscription.id });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(subscription.defaultTaxRates).toEqual([taxRateId]);
  expect(open.defaultTaxRates).toEqual([taxRateId]);
  expect(open.totalTaxAmount).toBe(200_000);
  expect(open.total).toBe(2_200_000);
});

it('lets a subscription item override the default tax rates of its subscription', async () => {
  const defaultTaxRateId = await makeTaxRate({ percentage: 10, inclusive: false });
  const itemTaxRateId = await makeTaxRate({ percentage: 5, inclusive: false });
  const customerId = await makeCustomerId();
  const product = await fastify.productService.createProduct({
    name: `Plan ${generateGid(ObjectPrefixEnum.PRODUCT)}`,
  });
  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 2_000_000,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });
  const subscription = await fastify.subscriptionService.createSubscription({
    customerId,
    items: [{ priceId: price.id, taxRates: [itemTaxRateId] }],
    defaultTaxRates: [defaultTaxRateId],
    billingMode: BillingModeEnum.ARREARS,
  });

  const draft = await fastify.invoiceService.createInvoice({ subscriptionId: subscription.id });
  const open = await fastify.invoiceService.finalizeInvoice(draft.id);

  expect(open.totalTaxAmount).toBe(100_000);
  expect(_.get(open.lineItems, '0.taxAmounts.0.taxRateId')).toBe(itemTaxRateId);
});

it('verifies a well formed tax id and records the verified name', async () => {
  const customerId = await makeCustomerId();
  const taxId = await fastify.taxIdService.createTaxId({
    customerId,
    type: TaxIdTypeEnum.VN_TIN,
    value: '0123456789',
    country: VIETNAM,
  });

  const verified = await fastify.taxIdService.verifyTaxId(taxId.id);

  expect(taxId.verification.status).toBe(TaxIdVerificationStatusEnum.PENDING);
  expect(verified.verification.status).toBe(TaxIdVerificationStatusEnum.VERIFIED);
  expect(verified.verification.verifiedName).toBe('Tax Buyer');
  expect(verified.verification.attemptedAt).not.toBeNull();
});

it('leaves a malformed tax id unverified', async () => {
  const customerId = await makeCustomerId();
  const taxId = await fastify.taxIdService.createTaxId({
    customerId,
    type: TaxIdTypeEnum.VN_TIN,
    value: 'not-a-tin',
  });

  const verified = await fastify.taxIdService.verifyTaxId(taxId.id);

  expect(verified.verification.status).toBe(TaxIdVerificationStatusEnum.UNVERIFIED);
  expect(verified.verification.verifiedName).toBeNull();
});

it('stops listing a tax id once it is deleted', async () => {
  const customerId = await makeCustomerId();
  const taxId = await fastify.taxIdService.createTaxId({
    customerId,
    type: TaxIdTypeEnum.EU_VAT,
    value: 'DE123456789',
  });

  await fastify.taxIdService.deleteTaxId(taxId.id);

  const { data: taxIds } = await fastify.taxIdService.findTaxIds({ customerId });

  expect(taxIds).toEqual([]);
});
