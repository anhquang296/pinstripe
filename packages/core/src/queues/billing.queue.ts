import { QueueNameEnum } from '@queues/queue-name';

export const BILLING_QUEUE = QueueNameEnum.BILLING;
export const BILLING_RUN_SHARD_JOB = 'BillingRunShard';
export const BILLING_RUN_DISPATCH_JOB = 'BillingRunDispatch';

export interface BillingRunShardJob {
  shardIndex: number;
  shardCount: number;
  runAt: string;
}

export function buildBillingRunShardJob(
  shardIndex: number,
  shardCount: number,
  runAt: Date,
): BillingRunShardJob {
  return { shardIndex, shardCount, runAt: runAt.toISOString() };
}
