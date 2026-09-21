import swagger from '@fastify/swagger';
import { VXRERP_API_VERSION } from '@vxrerp/core/contracts';
import fp from 'fastify-plugin';
import _ from 'lodash';

const BEARER_AUTH_SCHEME = 'bearerAuth';

export const swaggerPlugin = fp(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'VXR Billing Engine',
        version: VXRERP_API_VERSION,
      },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: {
          [BEARER_AUTH_SCHEME]: { type: 'http', scheme: 'bearer' },
        },
      },
      security: [{ [BEARER_AUTH_SCHEME]: [] }],
    },
    hideUntagged: true,
    transform: ({ schema, url }) => {
      const trimmedUrl = _.trimEnd(url, '/');

      if (trimmedUrl) {
        return { schema, url: trimmedUrl };
      }

      return { schema, url };
    },
  });
});
