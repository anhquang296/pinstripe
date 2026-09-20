import { authRoutes } from '@routes/auth/auth.routes';
import { hostedRoutes } from '@routes/hosted/hosted.routes';
import { portalRoutes } from '@routes/portal/portal.routes';
import { publicRoutes } from '@routes/public/public.routes';
import { v1Routes } from '@routes/v1/v1.routes';
import { webhooksRoutes } from '@routes/webhooks/webhooks.routes';
import fp from 'fastify-plugin';

export const apiRoutes = fp(async (fastify) => {
  await fastify.register(publicRoutes);
  await fastify.register(v1Routes, { prefix: '/v1' });
  await fastify.register(portalRoutes, { prefix: '/v1/portal' });
  await fastify.register(hostedRoutes, { prefix: '/v1/hosted' });
  // route-convention §"Every route declares a schema": better-auth owns the validation of every
  // body under /v1/auth, so this catch-all forwards an allowlist instead of declaring a schema.
  await fastify.register(authRoutes, { prefix: '/v1/auth' });
  await fastify.register(webhooksRoutes, { prefix: '/v1/webhooks' });
});
