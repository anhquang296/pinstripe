import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { BillingSchemeEnum, RecurringIntervalEnum, TiersModeEnum } from '@contracts/prices.types';
import type { Product } from '@contracts/products.types';
import { sql } from 'drizzle-orm';
import { BadRequestError, NotFoundError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import { buildTestContext } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function createProduct(): Promise<Product> {
  return fastify.productService.createProduct({
    name: `Plan ${generateId(ObjectPrefixEnum.PRODUCT)}`,
  });
}

describe('PriceService.createPrice', () => {
  it('starts a new lookup key at version one', async () => {
    const product = await createProduct();
    const lookupKey = `key_${generateId(ObjectPrefixEnum.PRICE)}`;

    const price = await fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
      lookupKey,
      unitAmount: 100_000,
      recurring: { interval: RecurringIntervalEnum.MONTH },
    });

    expect(price.version).toBe(1);
  });

  it('creates a new version instead of mutating the existing price', async () => {
    const product = await createProduct();
    const lookupKey = `key_${generateId(ObjectPrefixEnum.PRICE)}`;
    const first = await fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
      lookupKey,
      unitAmount: 100_000,
    });

    const second = await fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
      lookupKey,
      unitAmount: 120_000,
    });
    const reloadedFirst = await fastify.priceService.getPrice(first.id);

    expect(second.version).toBe(2);
    expect(reloadedFirst.unitAmount).toBe(100_000);
  });

  it('rejects a tiered price whose last tier does not catch all usage', async () => {
    const product = await createProduct();

    const act = fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
      billingScheme: BillingSchemeEnum.TIERED,
      tiersMode: TiersModeEnum.GRADUATED,
      tiers: [{ upTo: 10, unitAmount: 1000 }],
    });

    await expect(act).rejects.toThrowError(BadRequestError);
  });

  it('rejects a per unit price with no unit amount', async () => {
    const product = await createProduct();

    const act = fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
    });

    await expect(act).rejects.toThrowError(BadRequestError);
  });

  it('rejects a price for a product that does not exist', async () => {
    const act = fastify.priceService.createPrice({
      productId: generateId(ObjectPrefixEnum.PRODUCT),
      currency: CurrencyEnum.VND,
      unitAmount: 1000,
    });

    await expect(act).rejects.toThrowError(NotFoundError);
  });
});

describe('PriceService.resolvePrice', () => {
  it('returns the version in force at the given instant, not the newest one', async () => {
    const product = await createProduct();
    const lookupKey = `key_${generateId(ObjectPrefixEnum.PRICE)}`;
    await fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
      lookupKey,
      unitAmount: 100_000,
      effectiveAt: '2026-01-01T00:00:00.000Z',
    });
    await fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
      lookupKey,
      unitAmount: 150_000,
      effectiveAt: '2027-01-01T00:00:00.000Z',
    });

    const grandfathered = await fastify.priceService.resolvePrice(
      lookupKey,
      new Date('2026-06-01T00:00:00.000Z'),
    );
    const current = await fastify.priceService.resolvePrice(
      lookupKey,
      new Date('2027-06-01T00:00:00.000Z'),
    );

    expect(grandfathered.unitAmount).toBe(100_000);
    expect(current.unitAmount).toBe(150_000);
  });

  it('throws when no version is effective yet at that instant', async () => {
    const product = await createProduct();
    const lookupKey = `key_${generateId(ObjectPrefixEnum.PRICE)}`;
    await fastify.priceService.createPrice({
      productId: product.id,
      currency: CurrencyEnum.VND,
      lookupKey,
      unitAmount: 100_000,
      effectiveAt: '2027-01-01T00:00:00.000Z',
    });

    const act = fastify.priceService.resolvePrice(lookupKey, new Date('2026-01-01T00:00:00.000Z'));

    await expect(act).rejects.toThrowError(NotFoundError);
  });
});

describe('prices table constraints', () => {
  it('refuses a per unit price with no unit amount, even written straight to the database', async () => {
    const product = await createProduct();
    const priceId = generateId(ObjectPrefixEnum.PRICE);

    const act = fastify.database.master.execute(sql`
      insert into prices (id, product_id, version, effective_at, currency, type, billing_scheme, tax_behavior, created_at, updated_at)
      values (${priceId}, ${product.id}, 1, now(), 'vnd', 'one_time', 'per_unit', 'unspecified', now(), now())
    `);

    await expect(act).rejects.toThrowError(/prices_per_unit_shape/);
  });

  it('refuses a recurring price with no interval', async () => {
    const product = await createProduct();
    const priceId = generateId(ObjectPrefixEnum.PRICE);

    const act = fastify.database.master.execute(sql`
      insert into prices (id, product_id, version, effective_at, currency, type, billing_scheme, unit_amount, tax_behavior, created_at, updated_at)
      values (${priceId}, ${product.id}, 1, now(), 'vnd', 'recurring', 'per_unit', 1000, 'unspecified', now(), now())
    `);

    await expect(act).rejects.toThrowError(/prices_recurring_shape/);
  });
});
