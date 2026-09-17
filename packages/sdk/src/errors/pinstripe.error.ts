export interface ApiErrorBody {
  error: {
    type: string;
    code?: string;
    param?: string;
    message: string;
    requestId: string;
  };
}

export class PinstripeError extends Error {
  readonly statusCode: number;
  readonly type: string;
  readonly requestId: string;
  readonly code: string | null;
  readonly param: string | null;

  constructor(
    message: string,
    statusCode: number,
    type: string,
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
