import type { FastifyInstance } from 'fastify';

export interface Workflow {
  destroy(): Promise<void>;
}

export interface WorkflowConstructor {
  new (fastify: FastifyInstance): Workflow;
}
