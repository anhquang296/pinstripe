import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';

const SWAGGER_UI_PATH = '/docs';

export const swaggerUiPlugin = fp(async (fastify) => {
  await fastify.register(swaggerUi, { routePrefix: SWAGGER_UI_PATH });
});
