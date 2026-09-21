import { VxrErpClient } from '@client/vxr-erp.client';
import type { FetchImpl } from '@client/vxr-erp.types';
import { expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function setup(body: unknown, status = 200) {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body, status));

  const client = new VxrErpClient({
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

it('sends the one api key the client was built with', async () => {
  const { client, fetchImpl } = setup({ url: '/v1/api_keys', hasMore: false, data: [] });

  await client.apiKeys.find();

  const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];

  const headers = init.headers as Record<string, string>;

  expect(headers.authorization).toBe('Bearer sk_test_1');
});

it('creates an api key with the permissions it was given', async () => {
  const { client, fetchImpl } = setup({ id: 'ak_1' }, 201);

  const payload = {
    name: 'ci',
    module: 'billing',
    type: 'secret',
    permissions: ['billing.read'],
  } as const;

  await client.apiKeys.create({ ...payload, permissions: [...payload.permissions] });

  const { url, method, body } = readCall(fetchImpl);

  expect(url).toBe('/v1/api_keys');
  expect(method).toBe('POST');
  expect(body).toBe(JSON.stringify(payload));
});

it('deletes an api key by id', async () => {
  const { client, fetchImpl } = setup({ id: 'ak_1' });

  await client.apiKeys.delete('ak_1');

  expect(readCall(fetchImpl)).toMatchObject({ url: '/v1/api_keys/ak_1', method: 'DELETE' });
});
