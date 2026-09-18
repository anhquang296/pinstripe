import { adminRoutes } from '@routes/admin/admin.routes';
import { hostedRoutes } from '@routes/hosted/hosted.routes';
import { managementRoutes } from '@routes/management/management.routes';
import { portalRoutes } from '@routes/portal/portal.routes';
import { publicRoutes } from '@routes/public/public.routes';
import { systemRoutes } from '@routes/system/system.routes';
import { v1Routes } from '@routes/v1/v1.routes';
import fp from 'fastify-plugin';

export const apiRoutes = fp(async (fastify) => {
  await fastify.register(publicRoutes);
  await fastify.register(v1Routes, { prefix: '/v1' });
  await fastify.register(portalRoutes, { prefix: '/portal' });
  await fastify.register(hostedRoutes, { prefix: '/hosted' });
  await fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(systemRoutes, { prefix: '/api/v1/system' });
  await fastify.register(managementRoutes, { prefix: '/api/v1/management' });
});
