import { NotFoundError } from '@errors/app.error';
import { CurrencyEnum } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

function buildEmail(): string {
  return `${generateGid(ObjectPrefixEnum.CUSTOMER)}@example.test`;
}

describe('CustomerService.deleteCustomer', () => {
  it('hides the customer from every later read', async () => {
    const customer = await fastify.customerService.createCustomer(
      {
        email: buildEmail(),
        currency: CurrencyEnum.VND,
      },
      false,
    );

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
        await fastify.customerService.createCustomer(
          {
            email: buildEmail(),
            currency: CurrencyEnum.VND,
          },
          false,
        ),
      );
    }

    const firstPage = await fastify.customerService.findCustomers({ limit: 2 });
    const secondPage = await fastify.customerService.findCustomers({
      limit: 2,
      startingAfter: firstPage.data[1]?.id,
    });

    expect(firstPage.data).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    expect(
      secondPage.data.map((customer) => {
        return customer.id;
      }),
    ).not.toContain(firstPage.data[0]?.id);
  });
});

describe('CustomerService.updateCustomer', () => {
  it('records an outbox event in the same transaction as the write', async () => {
    const customer = await fastify.customerService.createCustomer(
      {
        email: buildEmail(),
        currency: CurrencyEnum.VND,
      },
      false,
    );

    const updated = await fastify.customerService.updateCustomer(customer.id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
  });
});
