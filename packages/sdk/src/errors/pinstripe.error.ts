import type { ErrorType } from '@type/contracts.types';

export class PinstripeError extends Error {
  readonly statusCode: number;
  readonly type: ErrorType;
  readonly requestId: string;
  readonly code: string | null;
  readonly param: string | null;

  constructor(
    message: string,
    statusCode: number,
    type: ErrorType,
    requestId: string,
    code: string | null = null,
    param: string | null = null,
  ) {
    super(message);

    this.name = 'PinstripeError';
    this.statusCode = statusCode;
    this.type = type;
    this.requestId = requestId;
    this.code = code;
    this.param = param;
  }
}

export class PinstripeConnectionError extends Error {
  constructor(message: string, cause: unknown = null) {
    super(message, { cause });

    this.name = 'PinstripeConnectionError';
  }
}

export class PinstripeSignatureVerificationError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'PinstripeSignatureVerificationError';
  }
}
