import { QueueNameEnum } from '@queues/queue-name';

export const OUTBOX_QUEUE = QueueNameEnum.OUTBOX;
export const OUTBOX_RELAY_JOB = 'OutboxRelay';

export interface OutboxRelayJob {
  batchSize: number;
}

export function buildOutboxRelayJob(batchSize: number): OutboxRelayJob {
  return { batchSize };
}
