import { isNil } from 'lodash-es';
export interface RequestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  params?: Record<string, unknown>;
  payload?: unknown;
}

export type RequestConfigFn = (config: RequestConfig) => RequestConfig;

export interface ApiErrorBody {
  error: {
    type: string;
    code?: string;
    param?: string;
    message: string;
    requestId: string;
  };
}

export class PinstripeApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly type: string,
    readonly requestId: string,
    readonly code?: string,
    readonly param?: string,
  ) {
    super(message);
    this.name = 'PinstripeApiError';
  }
}

function set(field: keyof RequestConfig, value: unknown): RequestConfigFn {
  return (config) => {
    if (isNil(value)) {
      return config;
    }

    return { ...config, [field]: value };
  };
}

export function Endpoint(url: string): RequestConfigFn {
  return set('url', url);
}

export function Method(method: string): RequestConfigFn {
  return set('method', method);
}

export function Params(params: object | undefined): RequestConfigFn {
  return set('params', params);
}

export function Payload(payload: object | undefined): RequestConfigFn {
  return set('payload', payload);
}

export function Headers(headers: Record<string, string> | undefined): RequestConfigFn {
  return (config) => {
    if (isNil(headers)) {
      return config;
    }

    return { ...config, headers: { ...config.headers, ...headers } };
  };
}

function buildUrl(config: RequestConfig): string {
  if (!config.params) {
    return config.url;
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(config.params)) {
    if (!isNil(value)) {
      search.set(key, String(value));
    }
  }

  return `${config.url}?${search.toString()}`;
}

export async function Request<T>(...fns: RequestConfigFn[]): Promise<T> {
  const config = fns.reduceRight<RequestConfig>(
    (result, fn) => {
      return fn(result);
    },
    {
      url: '',
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    },
  );

  const response = await fetch(buildUrl(config), {
    method: config.method,
    headers: config.headers,
    body: config.payload ? JSON.stringify(config.payload) : undefined,
  });

  const body: unknown = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    const envelope = body as ApiErrorBody | null;

    if (envelope?.error) {
      throw new PinstripeApiError(
        envelope.error.message,
        response.status,
        envelope.error.type,
        envelope.error.requestId,
        envelope.error.code,
        envelope.error.param,
      );
    }

    throw new Error(`Request failed with status ${response.status}`);
  }

  return body as T;
}
