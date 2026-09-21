import { VXRERP_API_VERSION } from '@vxrerp/platform/contracts';
import fp from 'fastify-plugin';

const API_VERSION_HEADER = 'vxrerp-version';

export const apiVersionPlugin = fp(async (fastify) => {
  fastify.addHook('onSend', async (_request, reply, payload) => {
    reply.header(API_VERSION_HEADER, VXRERP_API_VERSION);

    return payload;
  });
});
