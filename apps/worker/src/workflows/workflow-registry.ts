import type { WorkflowName } from '@pinstripe/core/queues';
import { WorkflowNameEnum } from '@pinstripe/core/queues';
import { UnknownWorkflowError } from '@type/errors';
import { BillingWorkflow } from '@workflows/billing.workflow';
import { DomainEventWorkflow } from '@workflows/domain-event.workflow';
import { DunningWorkflow } from '@workflows/dunning.workflow';
import { LedgerWorkflow } from '@workflows/ledger.workflow';
import { OutboxWorkflow } from '@workflows/outbox.workflow';
import { TaxWorkflow } from '@workflows/tax.workflow';
import { WebhookWorkflow } from '@workflows/webhook.workflow';
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

    throw new UnknownWorkflowError(
      `WorkflowRegistry resolve() unknown workflow ${name}, expected one of ${[...this.workflows.keys()].join(', ')}`,
    );
  }
}

export const workflowRegistry = new WorkflowRegistry();

workflowRegistry.add(WorkflowNameEnum.OUTBOX, OutboxWorkflow);
workflowRegistry.add(WorkflowNameEnum.DOMAIN_EVENT, DomainEventWorkflow);
workflowRegistry.add(WorkflowNameEnum.LEDGER, LedgerWorkflow);
workflowRegistry.add(WorkflowNameEnum.BILLING, BillingWorkflow);
workflowRegistry.add(WorkflowNameEnum.WEBHOOK, WebhookWorkflow);
workflowRegistry.add(WorkflowNameEnum.DUNNING, DunningWorkflow);
workflowRegistry.add(WorkflowNameEnum.TAX, TaxWorkflow);
