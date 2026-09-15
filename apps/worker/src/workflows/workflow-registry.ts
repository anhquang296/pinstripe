import type { WorkflowName } from '@pinstripe/core/queues';
import { WorkflowNameEnum } from '@pinstripe/core/queues';
import { DomainEventWorkflow } from '@workflows/domain-event.workflow';
import { OutboxWorkflow } from '@workflows/outbox.workflow';
import type { WorkflowConstructor } from '@workflows/workflow';

export class WorkflowRegistry {
  private readonly workflows = new Map<WorkflowName, WorkflowConstructor>();

  add(name: WorkflowName, workflow: WorkflowConstructor): void {
    this.workflows.set(name, workflow);
  }

  remove(name: WorkflowName): void {
    this.workflows.delete(name);
  }

  has(name: string): boolean {
    return this.workflows.has(name as WorkflowName);
  }

  resolve(name: string): WorkflowConstructor {
    const workflow = this.workflows.get(name as WorkflowName);

    if (workflow) {
      return workflow;
    }

    throw new Error(
      `WorkflowRegistry resolve() unknown workflow ${name}, expected one of ${[...this.workflows.keys()].join(', ')}`,
    );
  }
}

export const workflowRegistry = new WorkflowRegistry();

workflowRegistry.add(WorkflowNameEnum.OUTBOX, OutboxWorkflow);
workflowRegistry.add(WorkflowNameEnum.DOMAIN_EVENT, DomainEventWorkflow);
