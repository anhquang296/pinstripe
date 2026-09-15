import { workflowRegistry } from '@workflows/workflow-registry';
import { buildContext } from './context';

async function main(): Promise<void> {
  const workflowName = process.env.WORKFLOW_NAME;

  if (!workflowName) {
    throw new Error('main() WORKFLOW_NAME is required to start a worker process');
  }

  const WorkflowClass = workflowRegistry.resolve(workflowName);
  const fastify = await buildContext();
  const workflow = new WorkflowClass(fastify);

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      fastify.log.warn(`shutdown() ignoring ${signal}, shutdown already in progress`);

      return;
    }

    shuttingDown = true;
    fastify.log.info(`shutdown() received ${signal}, draining ${workflowName} workflow`);

    await workflow.destroy();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  await fastify.listen({ port: fastify.config.WORKER_PORT, host: fastify.config.API_HOST });
  fastify.log.info(`main() ${workflowName} workflow started`);
}

main().catch((error: unknown) => {
  process.stderr.write(`main() failed to start worker: ${String(error)}\n`);
  process.exit(1);
});
