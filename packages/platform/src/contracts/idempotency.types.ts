export enum IdempotencyStatusEnum {
  IN_PROGRESS = 'in_progress',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}
export type IdempotencyStatus = `${IdempotencyStatusEnum}`;
