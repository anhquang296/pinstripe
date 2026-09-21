import type { AggregateType } from '@contracts/events.types';
import type { DomainEventDispatchJob } from '@queues/domain-event.queue';

export interface DomainEventHandler {
  name: string;
  aggregateTypes: readonly AggregateType[];
  handle(event: DomainEventDispatchJob): Promise<void>;
}
