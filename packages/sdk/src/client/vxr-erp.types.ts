export enum HttpMethodEnum {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export type HttpMethod = `${HttpMethodEnum}`;

export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export type VxrErpConfig = {
  baseUrl?: string;
  apiKey?: string;
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
