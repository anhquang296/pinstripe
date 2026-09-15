import fp from 'fastify-plugin';

export interface ApiKeyRegistry {
  secret: string;
  admin: string;
  system: string;
  management: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    apiKeys: ApiKeyRegistry;
  }
}

export const apiKeyPlugin = fp(async (fastify) => {
  const { SECRET_API_KEY, ADMIN_API_KEY, SYSTEM_API_KEY, MANAGEMENT_API_KEY } = fastify.config;

  fastify.decorate('apiKeys', {
    secret: SECRET_API_KEY,
    admin: ADMIN_API_KEY,
    system: SYSTEM_API_KEY,
    management: MANAGEMENT_API_KEY,
  });
});
