import { AppError, ErrorTypeEnum } from '@errors/app.error';

export class IdempotencyConflictError extends AppError {
  readonly statusCode = 400;
  readonly type = ErrorTypeEnum.IDEMPOTENCY;
}

export class IdempotencyInProgressError extends AppError {
  readonly statusCode = 409;
  readonly type = ErrorTypeEnum.IDEMPOTENCY;
}
