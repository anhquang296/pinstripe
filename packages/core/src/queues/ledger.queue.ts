import { QueueNameEnum } from '@queues/queue-name';

export const LEDGER_QUEUE = QueueNameEnum.LEDGER;
export const LEDGER_INTEGRITY_CHECK_JOB = 'LedgerIntegrityCheck';

export interface LedgerIntegrityCheckJob {
  batchSize: number;
}

export function buildLedgerIntegrityCheckJob(batchSize: number): LedgerIntegrityCheckJob {
  return { batchSize };
}
