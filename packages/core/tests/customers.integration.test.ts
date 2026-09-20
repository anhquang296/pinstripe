import { BadRequestError, NotFoundError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildTestContext } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await fastify.close();
});

function buildEmail(): string {
  return `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`;
}

describe('CustomerService.createCustomer', () => {
  it('throws BadRequestError when attaching a test clock while test clocks are disabled', async () => {
    const testClock = await fastify.testClockService.createTestClock({
      name: `clock ${generateGid(ObjectPrefixEnum.TEST_CLOCK)}`,
      frozenTime: '2026-06-01T00:00:00.000Z',
    });

    vi.spyOn(fastify.testClockService, 'isEnabled', 'get').mockReturnValue(false);

    const act = fastify.customerService.createCustomer({
      email: buildEmail(),
      currency: CurrencyEnum.VND,
      testClockId: testClock.id,
    });

    await expect(act).rejects.toThrowError(BadRequestError);
  });
});

describe('CustomerService.deleteCustomer', () => {
  it('hides the customer from every later read', async () => {
    const customer = await fastify.customerService.createCustomer({
      email: buildEmail(),
      currency: CurrencyEnum.VND,
    });

    await fastify.customerService.deleteCustomer(customer.id);
    const act = fastify.customerService.getCustomer(customer.id);

    await expect(act).rejects.toThrowError(NotFoundError);
  });
});

describe('CustomerService.findCustomers', () => {
  it('walks pages without repeating a row', async () => {
    const created = [];

    for (let index = 0; index < 3; index += 1) {
      created.push(
        await fastify.customerService.createCustomer({
          email: buildEmail(),
          currency: CurrencyEnum.VND,
        }),
      );
    }

    const firstPage = await fastify.customerService.findCustomers({ limit: 2 });
    const after = _.get(firstPage.data, '1.id');

    const secondPage = await fastify.customerService.findCustomers({ limit: 2, after });
    const firstCustomerId = _.get(firstPage.data, '0.id');

    expect(firstPage.data).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    expect(_.map(secondPage.data, 'id')).not.toContain(firstCustomerId);
  });
});

describe('CustomerService.updateCustomer', () => {
  it('records an outbox event in the same transaction as the write', async () => {
    const customer = await fastify.customerService.createCustomer({
      email: buildEmail(),
      currency: CurrencyEnum.VND,
    });

    const updated = await fastify.customerService.updateCustomer(customer.id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
  });
});
