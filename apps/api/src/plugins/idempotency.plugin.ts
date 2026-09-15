import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    idempotencyTicketId?: string;
  }
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENCY_HEADER = 'idempotency-key';
const DEFAULT_SCOPE = 'default';

export const idempotencyPlugin = fp(async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const key = request.headers[IDEMPOTENCY_HEADER];

    if (!MUTATING_METHODS.has(request.method) || typeof key !== 'string') {
      return;
    }

    const ticket = await fastify.idempotencyService.beginRequest({
      scope: DEFAULT_SCOPE,
      key,
      route: request.routeOptions.url ?? request.url,
      body: request.body,
    });

    if (ticket.replay) {
      await reply
        .header('idempotent-replayed', 'true')
        .code(ticket.replay.statusCode)
        .send(ticket.replay.body);

      return;
    }

    request.idempotencyTicketId = ticket.id;
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    const ticketId = request.idempotencyTicketId;

    if (!ticketId) {
      return payload;
    }

    if (reply.statusCode >= 500) {
      await fastify.idempotencyService.releaseRequest(ticketId);

      return payload;
    }

    const body = typeof payload === 'string' ? (JSON.parse(payload) as unknown) : null;

    await fastify.idempotencyService.completeRequest(ticketId, reply.statusCode, body);

    return payload;
  });
});
