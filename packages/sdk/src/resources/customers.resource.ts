import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreateCustomerBalanceTransactionPayload,
  CreateCustomerPayload,
  CustomerBalanceTransactionResponse,
  CustomerResponse,
  DeletedCustomerResponse,
  FindCustomerBalanceTransactionsQuery,
  FindCustomersQuery,
  ListResponse,
  UpdateCustomerPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const CUSTOMERS_PATH = '/v1/customers';

export class CustomersResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindCustomersQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<CustomerResponse>> {
    return this._transport.request({
      path: CUSTOMERS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(customerId: string, options?: RequestOptions): Promise<CustomerResponse> {
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

  findBalanceTransactions(
    customerId: string,
    query: FindCustomerBalanceTransactionsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<CustomerBalanceTransactionResponse>> {
    return this._transport.request({
      path: buildPath(CUSTOMERS_PATH, customerId, 'balance_transactions'),
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  createBalanceTransaction(
    customerId: string,
    payload: CreateCustomerBalanceTransactionPayload,
    options?: RequestOptions,
  ): Promise<CustomerBalanceTransactionResponse> {
    return this._transport.request({
      path: buildPath(CUSTOMERS_PATH, customerId, 'balance_transactions'),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
