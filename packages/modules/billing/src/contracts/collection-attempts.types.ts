export enum CollectionAttemptStatusEnum {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}
export type CollectionAttemptStatus = `${CollectionAttemptStatusEnum}`;
