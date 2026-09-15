import type { GetPricesQuery, ListResponse, Price } from '@pinstripe/core/contracts';
import { Endpoint, Method, Params, Request } from '@api/request';

const PRICES_PATH = '/v1/prices';

export function getPrices(query: GetPricesQuery = {}): Promise<ListResponse<Price>> {
  return Request<ListResponse<Price>>(
    Endpoint(PRICES_PATH),
    Method('GET'),
    Params(query as Record<string, unknown>),
  );
}

export function getPrice(priceId: string): Promise<Price> {
  return Request<Price>(Endpoint(`${PRICES_PATH}/${encodeURIComponent(priceId)}`), Method('GET'));
}
