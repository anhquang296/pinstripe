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
    adminApiKey: 'ak_test_1',
  });

  return { client, fetchImpl };
}

function readCall(fetchImpl: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];

  return { url, method: init.method, body: init.body };
}

it('finds users through the admin surface', async () => {
  const { client, fetchImpl } = setup({ url: '/api/v1/admin/users', hasMore: false, data: [] });

  await client.admin.users.find({ role: 'admin' });

  expect(readCall(fetchImpl)).toMatchObject({
    url: '/api/v1/admin/users?role=admin',
    method: 'GET',
  });
});

it('encodes the user id of a get', async () => {
  const { client, fetchImpl } = setup({ id: 'usr_1' });

  await client.admin.users.get('usr/1 2');

  expect(readCall(fetchImpl).url).toBe('/api/v1/admin/users/usr%2F1%202');
});

it('creates a user with a POST body', async () => {
  const { client, fetchImpl } = setup({ id: 'usr_1' }, 201);

  await client.admin.users.create({
    email: 'operator@pinstripe.test',
    name: 'Operator',
    role: 'member',
  });

  const { url, method, body } = readCall(fetchImpl);

  expect(url).toBe('/api/v1/admin/users');
  expect(method).toBe('POST');
  expect(body).toBe(
    JSON.stringify({ email: 'operator@pinstripe.test', name: 'Operator', role: 'member' }),
  );
});

it('updates a user with a PATCH', async () => {
  const { client, fetchImpl } = setup({ id: 'usr_1' });

  await client.admin.users.update('usr_1', { role: 'moderator' });

  expect(readCall(fetchImpl)).toMatchObject({
    url: '/api/v1/admin/users/usr_1',
    method: 'PATCH',
  });
});

it('reads the account of the signed-in session', async () => {
  const { client, fetchImpl } = setup({ user: { id: 'usr_1' }, permissions: [] });

  await client.admin.account.get();

  expect(readCall(fetchImpl)).toMatchObject({ url: '/api/v1/admin/account', method: 'GET' });
});

it('sends the admin api key on an admin resource', async () => {
  const { client, fetchImpl } = setup({ url: '/api/v1/admin/api_keys', hasMore: false, data: [] });

  await client.admin.apiKeys.find();

  const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];

  const headers = init.headers as Record<string, string>;

  expect(headers.authorization).toBe('Bearer ak_test_1');
});

it('creates an api key', async () => {
  const { client, fetchImpl } = setup({ id: 'ak_1' }, 201);

  await client.admin.apiKeys.create({ name: 'ci', type: 'secret', scopes: ['v1'] });

  expect(readCall(fetchImpl)).toMatchObject({ url: '/api/v1/admin/api_keys', method: 'POST' });
});

it('deletes an api key by id', async () => {
  const { client, fetchImpl } = setup({ id: 'ak_1' });

  await client.admin.apiKeys.delete('ak_1');

  expect(readCall(fetchImpl)).toMatchObject({
    url: '/api/v1/admin/api_keys/ak_1',
    method: 'DELETE',
  });
});
