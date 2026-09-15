import { WorkerStartupError } from '@type/errors';
import { workflowRegistry } from '@workflows/workflow-registry';

import { buildContext } from './context';

declare module 'fastify' {
  interface FastifyInstance {
    startDraining: () => void;
  }
}

async function main(): Promise<void> {
  const workflowName = process.env.WORKFLOW_NAME;

  if (!workflowName) {
    throw new WorkerStartupError('main() WORKFLOW_NAME is required to start a worker process');
  }

  const WorkflowClass = workflowRegistry.resolve(workflowName);
  const fastify = await buildContext();
  const workflow = new WorkflowClass(fastify);

  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      fastify.log.warn({ signal }, 'shutdown() skipped, shutdown already in progress');

      return;
    }

    isShuttingDown = true;
    fastify.startDraining();
    fastify.log.info({ signal, workflowName }, 'shutdown() draining workflow');

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

  await fastify.listen(fastify.workerAddress);
  fastify.log.info({ workflowName }, 'main() workflow started');
}

main().catch((error: unknown) => {
  process.stderr.write(`main() failed to start worker: ${String(error)}\n`);
  process.exit(1);
});
