import type { AggregateType, DomainEventType } from '@contracts/events.types';
import { QueueNameEnum } from '@queues/queue-name';

export const DOMAIN_EVENT_QUEUE = QueueNameEnum.DOMAIN_EVENT;
export const DOMAIN_EVENT_DISPATCH_JOB = 'DomainEventDispatch';

export interface DomainEventDispatchJob {
  eventId: string;
  livemode: boolean;
  eventType: DomainEventType;
  aggregateType: AggregateType;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export function buildDomainEventDispatchJob(
  event: Omit<DomainEventDispatchJob, 'occurredAt'> & { occurredAt: Date },
): DomainEventDispatchJob {
  return { ...event, occurredAt: event.occurredAt.toISOString() };
}
