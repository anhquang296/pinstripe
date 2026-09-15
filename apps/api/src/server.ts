import { buildApp } from './app';

async function main(): Promise<void> {
  const fastify = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    fastify.log.info(`shutdown() received ${signal}, closing server`);

    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  await fastify.listen({ port: fastify.config.API_PORT, host: fastify.config.API_HOST });
}

main().catch((error: unknown) => {
  process.stderr.write(`main() failed to start api: ${String(error)}\n`);
  process.exit(1);
});
