import { PinstripeClient } from '@client/pinstripe.client';
import type { FetchImpl } from '@client/pinstripe.types';
import { expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function setup(body: unknown, status = 200) {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body, status));

  const client = new PinstripeClient({
    baseUrl: '',
    fetch: fetchImpl as FetchImpl,
    maxRetries: 0,
    apiKey: 'sk_test_1',
  });

  return { client, fetchImpl };
}

function readCall(fetchImpl: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];

  return { url, method: init.method, body: init.body };
}

it('finds ledger accounts under the ledger namespace', async () => {
  const { client, fetchImpl } = setup({ url: '/v1/ledger/accounts', hasMore: false, data: [] });

  await client.ledger.accounts.find();

  expect(readCall(fetchImpl)).toMatchObject({ url: '/v1/ledger/accounts', method: 'GET' });
});

it('encodes the ledger account id of a get', async () => {
  const { client, fetchImpl } = setup({ id: 'lacc_1' });

  await client.ledger.accounts.get('lacc/1 2');

  expect(readCall(fetchImpl).url).toBe('/v1/ledger/accounts/lacc%2F1%202');
});

it('posts a ledger transaction', async () => {
  const { client, fetchImpl } = setup({ id: 'ltxn_1' }, 201);

  await client.ledger.transactions.create({
    description: 'manual',
    currency: 'vnd',
    entries: [],
  });

  expect(readCall(fetchImpl)).toMatchObject({ url: '/v1/ledger/transactions', method: 'POST' });
});

it('reverses a ledger transaction by id', async () => {
  const { client, fetchImpl } = setup({ id: 'ltxn_2' }, 201);

  await client.ledger.transactions.reverse('ltxn_1', { reason: 'mistake' });

  expect(readCall(fetchImpl)).toMatchObject({
    url: '/v1/ledger/transactions/ltxn_1/reverse',
    method: 'POST',
  });
});
