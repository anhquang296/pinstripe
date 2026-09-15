import { Endpoint, Method, Params, Request } from '@api/client';

import type { GetPricesQuery, ListResponse, PriceResponse } from './type';

const PRICES_PATH = '/v1/prices';

export function getPrices(query: GetPricesQuery = {}): Promise<ListResponse<PriceResponse>> {
  return Request<ListResponse<PriceResponse>>(Endpoint(PRICES_PATH), Method('GET'), Params(query));
}

export function getPrice(priceId: string): Promise<PriceResponse> {
  return Request<PriceResponse>(
    Endpoint(`${PRICES_PATH}/${encodeURIComponent(priceId)}`),
    Method('GET'),
  );
}
