import { PinstripeClient } from '@client/pinstripe.client';
import type { FetchImpl } from '@client/pinstripe.types';
import { PinstripeConnectionError, PinstripeError } from '@errors/pinstripe.error';
import { describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function setup(fetchImpl: FetchImpl, overrides: { apiKey?: string; maxRetries?: number } = {}) {
  const { apiKey, maxRetries = 0 } = overrides;

  const client = new PinstripeClient({
    baseUrl: '',
    fetch: fetchImpl,
    maxRetries,
    apiKey,
  });

  return { client };
}

function readCall(fetchImpl: ReturnType<typeof vi.fn>, index = 0) {
  const [url, init] = fetchImpl.mock.calls[index] as [string, RequestInit];

  const headers = init.headers as Record<string, string>;

  return { url, init, headers };
}

it('builds a relative url when baseUrl is empty', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ hasMore: false, data: [] }));

  const { client } = setup(fetchImpl);

  await client.customers.find();

  expect(readCall(fetchImpl).url).toBe('/v1/customers');
});

it('encodes a path parameter', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'cus_1' }));

  const { client } = setup(fetchImpl);

  await client.customers.get('cus/1 2');

  expect(readCall(fetchImpl).url).toBe('/v1/customers/cus%2F1%202');
});

it('keeps falsy query values and drops undefined ones', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ hasMore: false, data: [] }));

  const { client } = setup(fetchImpl);

  await client.customers.find({ limit: 0, email: '', after: undefined } as never);

  expect(readCall(fetchImpl).url).toBe('/v1/customers?limit=0&email=');
});

it('sends the authorization header when an apiKey is configured', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ hasMore: false, data: [] }));

  const { client } = setup(fetchImpl, { apiKey: 'sk_test_1' });

  await client.customers.find();

  expect(readCall(fetchImpl).headers.authorization).toBe('Bearer sk_test_1');
});

it('omits the authorization header when no apiKey is configured', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ hasMore: false, data: [] }));

  const { client } = setup(fetchImpl);

  await client.customers.find();

  expect(readCall(fetchImpl).headers.authorization).toBeUndefined();
});

it('generates an idempotency key for a mutating request', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'cus_1' }, 201));

  const { client } = setup(fetchImpl);

  await client.customers.create({ currency: 'usd' } as never);

  expect(readCall(fetchImpl).headers['idempotency-key']).toEqual(expect.any(String));
});

it('omits content-type on a request that carries no body', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'cus_1', deleted: true }));

  const { client } = setup(fetchImpl);

  await client.customers.delete('cus_1');

  const { headers, init } = readCall(fetchImpl);

  expect(headers['content-type']).toBeUndefined();
  expect(init.body).toBeUndefined();
});

it('sends content-type on a request that carries a body', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'cus_1' }, 201));

  const { client } = setup(fetchImpl);

  await client.customers.create({ currency: 'usd' } as never);

  expect(readCall(fetchImpl).headers['content-type']).toBe('application/json');
});

it('does not send an idempotency key on a read', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ hasMore: false, data: [] }));

  const { client } = setup(fetchImpl);

  await client.customers.find();

  expect(readCall(fetchImpl).headers['idempotency-key']).toBeUndefined();
});

it('uses the explicit idempotency key over a generated one', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'cus_1' }, 201));

  const { client } = setup(fetchImpl);

  await client.customers.create({ currency: 'usd' } as never, { idempotencyKey: 'key_1' });

  expect(readCall(fetchImpl).headers['idempotency-key']).toBe('key_1');
});

it('reuses the same idempotency key across retries', async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse({ error: { type: 'api_error' } }, 503))
    .mockResolvedValueOnce(jsonResponse({ id: 'cus_1' }, 201));

  const { client } = setup(fetchImpl, { maxRetries: 1 });

  await client.customers.create({ currency: 'usd' } as never);

  expect(readCall(fetchImpl, 0).headers['idempotency-key']).toBe(
    readCall(fetchImpl, 1).headers['idempotency-key'],
  );
});

it('throws PinstripeError carrying every envelope field', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(
    jsonResponse(
      {
        error: {
          type: 'invalid_request_error',
          code: 'parameter_missing',
          param: 'currency',
          message: 'Missing currency',
          requestId: 'req_1',
        },
      },
      400,
    ),
  );

  const { client } = setup(fetchImpl);

  const error = await client.customers.find().catch((caught: unknown) => {
    return caught;
  });

  expect(error).toBeInstanceOf(PinstripeError);
  expect(error).toMatchObject({
    statusCode: 400,
    type: 'invalid_request_error',
    code: 'parameter_missing',
    param: 'currency',
    message: 'Missing currency',
    requestId: 'req_1',
  });
});

it('throws PinstripeConnectionError when the body carries no envelope', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 }));

  const { client } = setup(fetchImpl);

  await expect(client.customers.find()).rejects.toBeInstanceOf(PinstripeConnectionError);
});

it('throws PinstripeConnectionError when fetch rejects and retries are exhausted', async () => {
  const fetchImpl = vi.fn().mockRejectedValue(new TypeError('network down'));

  const { client } = setup(fetchImpl);

  await expect(client.customers.find()).rejects.toBeInstanceOf(PinstripeConnectionError);
});

it('returns null for a 204 without parsing a body', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

  const { client } = setup(fetchImpl);

  await expect(client.customers.find()).resolves.toBeNull();
});

describe('retry policy', () => {
  it.each([408, 429, 500, 502, 503, 504])('retries a %i response', async (statusCode) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { type: 'api_error' } }, statusCode))
      .mockResolvedValueOnce(jsonResponse({ hasMore: false, data: [] }));

    const { client } = setup(fetchImpl, { maxRetries: 1 });

    await client.customers.find();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 404, 409, 422])('does not retry a %i response', async (statusCode) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { error: { type: 'invalid_request_error', message: 'nope', requestId: 'req_1' } },
          statusCode,
        ),
      );

    const { client } = setup(fetchImpl, { maxRetries: 2 });

    await expect(client.customers.find()).rejects.toBeInstanceOf(PinstripeError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry when maxRetries is zero', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { type: 'api_error', message: 'boom', requestId: 'req_1' } }, 503),
      );

    const { client } = setup(fetchImpl, { maxRetries: 0 });

    await expect(client.customers.find()).rejects.toBeInstanceOf(PinstripeError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('honors a Retry-After header', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { type: 'api_error' } }, 429, { 'retry-after': '0' }),
      )
      .mockResolvedValueOnce(jsonResponse({ hasMore: false, data: [] }));

    const { client } = setup(fetchImpl, { maxRetries: 1 });

    await client.customers.find();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
