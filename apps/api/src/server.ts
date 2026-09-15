import { buildApp } from './app';

async function main(): Promise<void> {
  const fastify = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    fastify.log.info({ signal }, 'shutdown() closing server');

    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  await fastify.listen(fastify.serverAddress);
}

main().catch((error: unknown) => {
  process.stderr.write(`main() failed to start api: ${String(error)}\n`);
  process.exit(1);
});
