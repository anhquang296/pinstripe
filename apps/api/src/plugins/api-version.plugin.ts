import { PINSTRIPE_API_VERSION } from '@pinstripe/core/contracts';
import fp from 'fastify-plugin';

const API_VERSION_HEADER = 'pinstripe-version';

export const apiVersionPlugin = fp(async (fastify) => {
  fastify.addHook('onSend', async (_request, reply, payload) => {
    reply.header(API_VERSION_HEADER, PINSTRIPE_API_VERSION);

    return payload;
  });
});
