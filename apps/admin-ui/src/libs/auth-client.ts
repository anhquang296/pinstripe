import { createAuthClient } from 'better-auth/react';
import { get, isString } from 'lodash-es';

const AUTH_BASE_PATH = '/v1/auth';

export async function resolveAuthErrorResponse(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }

  const envelope: unknown = await response
    .clone()
    .json()
    .catch(() => {
      return null;
    });

  const code = get(envelope, 'error.code');
  const message = get(envelope, 'error.message');

  if (!isString(code) || !isString(message)) {
    return response;
  }

  return new Response(JSON.stringify({ code, message }), {
    status: response.status,
    statusText: response.statusText,
    headers: { 'content-type': 'application/json' },
  });
}

async function fetchAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);

  return resolveAuthErrorResponse(response);
}

export const authClient = createAuthClient({
  basePath: AUTH_BASE_PATH,
  fetchOptions: { customFetchImpl: fetchAuth },
});
