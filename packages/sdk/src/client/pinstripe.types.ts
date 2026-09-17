export enum HttpMethodEnum {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export type HttpMethod = `${HttpMethodEnum}`;

export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export type PinstripeConfig = {
  baseUrl?: string;
  apiKey?: string;
  adminApiKey?: string;
  fetch?: FetchImpl;
  maxRetries?: number;
  timeoutMs?: number;
  shouldGenerateIdempotencyKey?: boolean;
};

export interface RequestOptions {
  expand?: string[];
  idempotencyKey?: string;
  signal?: AbortSignal;
  maxRetries?: number;
}

export interface RequestConfig {
  path: string;
  method: HttpMethod;
  query?: Record<string, unknown>;
  payload?: unknown;
  options?: RequestOptions;
}

export interface TransportConfig {
  baseUrl: string;
  apiKey: string | null;
  fetch: FetchImpl;
  maxRetries: number;
  timeoutMs: number;
  shouldGenerateIdempotencyKey: boolean;
}
