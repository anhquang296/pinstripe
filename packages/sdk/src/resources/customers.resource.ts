import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateCustomerPayload,
  CustomerResponse,
  GetCustomersQuery,
  ListResponse,
  UpdateCustomerPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const CUSTOMERS_PATH = '/v1/customers';

export interface DeletedCustomerResponse {
  object: 'customer';
  id: string;
  deleted: true;
}

export class CustomersResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  list(
    query: GetCustomersQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<CustomerResponse>> {
    return this._transport.request({
      path: CUSTOMERS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  retrieve(customerId: string, options?: RequestOptions): Promise<CustomerResponse> {
    return this._transport.request({
      path: buildPath(CUSTOMERS_PATH, customerId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateCustomerPayload, options?: RequestOptions): Promise<CustomerResponse> {
    return this._transport.request({
      path: CUSTOMERS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    customerId: string,
    payload: UpdateCustomerPayload,
    options?: RequestOptions,
  ): Promise<CustomerResponse> {
    return this._transport.request({
      path: buildPath(CUSTOMERS_PATH, customerId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  delete(customerId: string, options?: RequestOptions): Promise<DeletedCustomerResponse> {
    return this._transport.request({
      path: buildPath(CUSTOMERS_PATH, customerId),
      method: HttpMethodEnum.DELETE,
      options,
    });
  }
}
