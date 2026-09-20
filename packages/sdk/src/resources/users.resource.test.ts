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

it('finds users through the product api', async () => {
  const { client, fetchImpl } = setup({ url: '/v1/users', hasMore: false, data: [] });

  await client.users.find({ role: 'admin' });

  expect(readCall(fetchImpl)).toMatchObject({ url: '/v1/users?role=admin', method: 'GET' });
});

it('encodes the user id of a get', async () => {
  const { client, fetchImpl } = setup({ id: 'usr_1' });

  await client.users.get('usr/1 2');

  expect(readCall(fetchImpl).url).toBe('/v1/users/usr%2F1%202');
});

it('creates a user with a POST body', async () => {
  const { client, fetchImpl } = setup({ id: 'usr_1' }, 201);

  await client.users.create({
    email: 'operator@pinstripe.test',
    name: 'Operator',
    role: 'member',
  });

  const { url, method, body } = readCall(fetchImpl);

  expect(url).toBe('/v1/users');
  expect(method).toBe('POST');
  expect(body).toBe(
    JSON.stringify({ email: 'operator@pinstripe.test', name: 'Operator', role: 'member' }),
  );
});

it('updates a user with a PATCH', async () => {
  const { client, fetchImpl } = setup({ id: 'usr_1' });

  await client.users.update('usr_1', { role: 'moderator' });

  expect(readCall(fetchImpl)).toMatchObject({ url: '/v1/users/usr_1', method: 'PATCH' });
});

it('reads the account of the signed-in session', async () => {
  const { client, fetchImpl } = setup({ user: { id: 'usr_1' }, permissions: [] });

  await client.account.get();

  expect(readCall(fetchImpl)).toMatchObject({ url: '/v1/account', method: 'GET' });
});
