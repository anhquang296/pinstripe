import type {
  FetchImpl,
  HttpMethod,
  RequestConfig,
  TransportConfig,
} from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import { isRetryableMethod, isRetryableStatus, resolveBackoffMs } from '@client/retry';
import { PinstripeConnectionError, PinstripeError } from '@errors/pinstripe.error';
import type { ApiErrorBody } from '@type/contracts.types';
import { buildQuery } from '@utils/build-query';

const MUTATING_METHODS: HttpMethod[] = [
  HttpMethodEnum.POST,
  HttpMethodEnum.PUT,
  HttpMethodEnum.PATCH,
  HttpMethodEnum.DELETE,
];

export class PinstripeTransport {
  private _baseUrl: string;
  private _apiKey: string | null;
  private _fetch: FetchImpl;
  private _maxRetries: number;
  private _timeoutMs: number;
  private _shouldGenerateIdempotencyKey: boolean;

  constructor(transportConfig: TransportConfig) {
    const { baseUrl, apiKey, fetch, maxRetries, timeoutMs, shouldGenerateIdempotencyKey } =
      transportConfig;

    this._baseUrl = baseUrl;
    this._apiKey = apiKey;
    this._fetch = fetch;
    this._maxRetries = maxRetries;
    this._timeoutMs = timeoutMs;
    this._shouldGenerateIdempotencyKey = shouldGenerateIdempotencyKey;
  }

  async request<T>(config: RequestConfig): Promise<T> {
    const { path, method, query, payload, options = {} } = config;
    const { idempotencyKey: explicitKey, signal, maxRetries = this._maxRetries } = options;

    const idempotencyKey = this._resolveIdempotencyKey(method, explicitKey);
    const canRetry = isRetryableMethod(method, Boolean(idempotencyKey));

    const url = this._buildUrl(path, query);
    const init = this._buildInit(method, payload, idempotencyKey);

    let attempt = 0;

    for (;;) {
      const response = await this._send(url, init, signal, canRetry && attempt < maxRetries);

      if (response) {
        if (response.ok) {
          return await this._readBody<T>(response);
        }

        if (canRetry && attempt < maxRetries && isRetryableStatus(response.status)) {
          await delay(resolveBackoffMs(attempt, response.headers.get('retry-after')));
          attempt += 1;

          continue;
        }

        throw await this._buildError(response);
      }

      await delay(resolveBackoffMs(attempt, null));
      attempt += 1;
    }
  }

  private async _send(
    url: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
    canRetry: boolean,
  ): Promise<Response | null> {
    if (signal?.aborted) {
      throw new PinstripeConnectionError('Request was aborted', signal.reason);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this._timeoutMs);

    const abortFromCaller = () => {
      controller.abort();
    };

    signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      return await this._fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (signal?.aborted) {
        throw new PinstripeConnectionError('Request was aborted', error);
      }

      if (canRetry) {
        return null;
      }

      throw new PinstripeConnectionError('Failed to reach the Pinstripe API', error);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  private _buildUrl(path: string, query: Record<string, unknown> | undefined): string {
    const search = buildQuery(query);
    const url = `${this._baseUrl}${path}`;

    if (search) {
      return `${url}?${search}`;
    }

    return url;
  }

  private _buildInit(
    method: HttpMethod,
    payload: unknown,
    idempotencyKey: string | null,
  ): RequestInit {
    const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

    const headers: Record<string, string> = {};

    if (payload !== undefined) {
      headers['content-type'] = 'application/json';
    }

    if (this._apiKey) {
      headers.authorization = `Bearer ${this._apiKey}`;
    }

    if (idempotencyKey) {
      headers[IDEMPOTENCY_KEY_HEADER] = idempotencyKey;
    }

    return {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
    };
  }

  private _resolveIdempotencyKey(
    method: HttpMethod,
    explicitKey: string | undefined,
  ): string | null {
    if (!MUTATING_METHODS.includes(method)) {
      return null;
    }

    if (explicitKey) {
      return explicitKey;
    }

    if (this._shouldGenerateIdempotencyKey) {
      return crypto.randomUUID();
    }

    return null;
  }

  private async _readBody<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return null as T;
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new PinstripeConnectionError('Pinstripe API returned a body that is not JSON', error);
    }
  }

  private async _buildError(response: Response): Promise<Error> {
    const body = await readJsonBody(response);
    const envelope = body as ApiErrorBody | null;
    const apiError = envelope?.error;

    if (apiError) {
      return new PinstripeError(
        apiError.message,
        response.status,
        apiError.type,
        apiError.requestId,
        apiError.code ?? null,
        apiError.param ?? null,
      );
    }

    return new PinstripeConnectionError(`Request failed with status ${response.status}`);
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
