import { describe, expect, it } from 'vitest';

import { resolveAuthErrorResponse } from './auth-client';

function buildEnvelopeResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('resolveAuthErrorResponse', () => {
  it('lifts the envelope code and message to the top level', async () => {
    const response = await resolveAuthErrorResponse(
      buildEnvelopeResponse(401, {
        error: {
          type: 'unauthorized_error',
          code: 'INVALID_EMAIL_OR_PASSWORD',
          param: null,
          message: 'Email hoặc mật khẩu không đúng.',
          requestId: 'req_1',
        },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 'INVALID_EMAIL_OR_PASSWORD',
      message: 'Email hoặc mật khẩu không đúng.',
    });
  });

  it('leaves a successful response untouched', async () => {
    const sessionResponse = buildEnvelopeResponse(200, { user: { id: 'usr_1' } });

    const response = await resolveAuthErrorResponse(sessionResponse);

    expect(response).toBe(sessionResponse);
  });

  it('leaves an error body that carries no envelope untouched', async () => {
    const htmlResponse = new Response('<html>502</html>', { status: 502 });

    const response = await resolveAuthErrorResponse(htmlResponse);

    expect(response).toBe(htmlResponse);
  });

  it('leaves an error body whose envelope has no code untouched', async () => {
    const partialResponse = buildEnvelopeResponse(400, { error: { message: 'thiếu code' } });

    const response = await resolveAuthErrorResponse(partialResponse);

    expect(response).toBe(partialResponse);
  });
});
