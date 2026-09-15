export enum ErrorTypeEnum {
  INVALID_REQUEST = 'invalid_request_error',
  AUTHENTICATION = 'authentication_error',
  IDEMPOTENCY = 'idempotency_error',
  RATE_LIMIT = 'rate_limit_error',
  CARD = 'card_error',
  API = 'api_error',
}
export type ErrorType = `${ErrorTypeEnum}`;

export interface AppErrorOptions {
  code?: string;
  param?: string;
  cause?: unknown;
}

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly type: ErrorType;

  readonly code: string | undefined;
  readonly param: string | undefined;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.param = options.param;
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly type = ErrorTypeEnum.INVALID_REQUEST;
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly type = ErrorTypeEnum.AUTHENTICATION;
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly type = ErrorTypeEnum.INVALID_REQUEST;
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly type = ErrorTypeEnum.INVALID_REQUEST;
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly type = ErrorTypeEnum.INVALID_REQUEST;
}

export class UnprocessableError extends AppError {
  readonly statusCode = 422;
  readonly type = ErrorTypeEnum.INVALID_REQUEST;
}

export class TooManyRequestsError extends AppError {
  readonly statusCode = 429;
  readonly type = ErrorTypeEnum.RATE_LIMIT;
}

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly type = ErrorTypeEnum.API;
}

export class UnknownQueueError extends AppError {
  readonly statusCode = 500;
  readonly type = ErrorTypeEnum.API;
}
