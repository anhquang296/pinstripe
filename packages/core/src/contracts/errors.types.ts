import type { ErrorType } from '@errors/app.error';

export type { ErrorType } from '@errors/app.error';

export interface ApiErrorResponse {
  error: {
    type: ErrorType;
    code?: string;
    param?: string;
    message: string;
    requestId: string;
  };
}
