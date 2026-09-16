import { QueueNameEnum } from '@queues/queue-name';

export const DUNNING_QUEUE = QueueNameEnum.DUNNING;
export const DUNNING_RUN_SHARD_JOB = 'DunningRunShard';

export interface DunningRunShardJob {
  shardIndex: number;
  shardCount: number;
  runAt: string;
}

export function buildDunningRunShardJob(
  shardIndex: number,
  shardCount: number,
  runAt: Date,
): DunningRunShardJob {
  return { shardIndex, shardCount, runAt: runAt.toISOString() };
}
