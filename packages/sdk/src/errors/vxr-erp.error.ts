import type { ErrorType } from '@type/contracts.types';

export class VxrErpError extends Error {
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

    this.name = 'VxrErpError';
    this.statusCode = statusCode;
    this.type = type;
    this.requestId = requestId;
    this.code = code;
    this.param = param;
  }
}

export class VxrErpConnectionError extends Error {
  constructor(message: string, cause: unknown = null) {
    super(message, { cause });

    this.name = 'VxrErpConnectionError';
  }
}

export class VxrErpSignatureVerificationError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'VxrErpSignatureVerificationError';
  }
}
