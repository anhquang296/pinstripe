import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateTaxRatePayload,
  FindTaxRatesQuery,
  ListResponse,
  TaxRateResponse,
  UpdateTaxRatePayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const TAX_RATES_PATH = '/v1/tax_rates';

export class TaxRatesResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindTaxRatesQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<TaxRateResponse>> {
    return this._transport.request({
      path: TAX_RATES_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(taxRateId: string, options?: RequestOptions): Promise<TaxRateResponse> {
    return this._transport.request({
      path: buildPath(TAX_RATES_PATH, taxRateId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateTaxRatePayload, options?: RequestOptions): Promise<TaxRateResponse> {
    return this._transport.request({
      path: TAX_RATES_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    taxRateId: string,
    payload: UpdateTaxRatePayload,
    options?: RequestOptions,
  ): Promise<TaxRateResponse> {
    return this._transport.request({
      path: buildPath(TAX_RATES_PATH, taxRateId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
