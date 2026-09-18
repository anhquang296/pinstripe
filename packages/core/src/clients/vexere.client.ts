import type { Logger } from '@type/logger';
import type {
  OperatorCollectionPayload,
  OperatorCollectionProvider,
  OperatorCollectionResult,
} from '@type/operator-collection-provider';
import _ from 'lodash';

const TICKET_OFFSETS_PATH = '/ticket-offsets';
const WALLET_DEBITS_PATH = '/wallet-debits';
const DEFAULT_TIMEOUT_MS = 10_000;

export type VexereConfig = {
  apiUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
};

export class VexereNotConfiguredError extends Error {
  constructor(message = 'The Vexere collection API is not configured') {
    super(message);
    this.name = 'VexereNotConfiguredError';
  }
}

export class VexereRequestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'VexereRequestError';
  }
}

export class VexereClient implements OperatorCollectionProvider {
  private _apiUrl: string;
  private _apiKey: string;
  private _timeoutMs: number;
  private _logger: Logger;

  constructor(vexereConfig: VexereConfig, logger: Logger) {
    const { apiUrl = '', apiKey = '', timeoutMs = DEFAULT_TIMEOUT_MS } = vexereConfig;

    this._apiUrl = apiUrl;
    this._apiKey = apiKey;
    this._timeoutMs = timeoutMs;
    this._logger = logger;
  }

  static isConfigured(vexereConfig: VexereConfig): boolean {
    return Boolean(vexereConfig.apiUrl && vexereConfig.apiKey);
  }

  async offsetTicketSales(payload: OperatorCollectionPayload): Promise<OperatorCollectionResult> {
    return this.collect(TICKET_OFFSETS_PATH, payload);
  }

  async debitWallet(payload: OperatorCollectionPayload): Promise<OperatorCollectionResult> {
    return this.collect(WALLET_DEBITS_PATH, payload);
  }

  private async collect(
    path: string,
    payload: OperatorCollectionPayload,
  ): Promise<OperatorCollectionResult> {
    if (VexereClient.isConfigured({ apiUrl: this._apiUrl, apiKey: this._apiKey })) {
      try {
        const response = await fetch(`${this._apiUrl}${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this._apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': payload.idempotencyKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this._timeoutMs),
        });

        if (response.ok) {
          const body: unknown = await response.json();

          return VexereClient.buildCollectionResult(body);
        }

        throw new VexereRequestError(`Vexere ${path} responded with ${response.status}`);
      } catch (error) {
        this._logger.error({ error, path }, '[VexereClient] collect() error');

        throw error;
      }
    }

    throw new VexereNotConfiguredError();
  }

  private static buildCollectionResult(body: unknown): OperatorCollectionResult {
    const appliedAmount: unknown = _.get(body, 'appliedAmount');
    const reference: unknown = _.get(body, 'reference', null);

    if (
      _.isNumber(appliedAmount) &&
      _.isSafeInteger(appliedAmount) &&
      (_.isString(reference) || _.isNull(reference))
    ) {
      return { appliedAmount, reference };
    }

    throw new VexereRequestError('Vexere returned a malformed collection result');
  }
}
