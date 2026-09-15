import type { FastifyInstance } from 'fastify';
import { adminRoutes } from '@routes/admin/admin.routes';
import { healthRoutes } from '@routes/health.routes';
import { managementRoutes } from '@routes/management/management.routes';
import { systemRoutes } from '@routes/system/system.routes';
import { v1Routes } from '@routes/v1/v1.routes';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoutes);
  await fastify.register(v1Routes, { prefix: '/v1' });
  await fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(systemRoutes, { prefix: '/api/v1/system' });
  await fastify.register(managementRoutes, { prefix: '/api/v1/management' });
}
