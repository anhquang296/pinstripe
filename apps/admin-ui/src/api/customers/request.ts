import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  CreateCustomerPayload,
  CustomerResponse,
  GetCustomersQuery,
  ListResponse,
  UpdateCustomerPayload,
} from './type';

const CUSTOMERS_PATH = '/v1/customers';

export function getCustomers(
  query: GetCustomersQuery = {},
): Promise<ListResponse<CustomerResponse>> {
  return Request<ListResponse<CustomerResponse>>(
    Endpoint(CUSTOMERS_PATH),
    Method('GET'),
    Params(query),
  );
}

export function getCustomer(customerId: string): Promise<CustomerResponse> {
  return Request<CustomerResponse>(
    Endpoint(`${CUSTOMERS_PATH}/${encodeURIComponent(customerId)}`),
    Method('GET'),
  );
}

export function createCustomer(payload: CreateCustomerPayload): Promise<CustomerResponse> {
  return Request<CustomerResponse>(Endpoint(CUSTOMERS_PATH), Method('POST'), Payload(payload));
}

export function updateCustomer(
  customerId: string,
  payload: UpdateCustomerPayload,
): Promise<CustomerResponse> {
  return Request<CustomerResponse>(
    Endpoint(`${CUSTOMERS_PATH}/${encodeURIComponent(customerId)}`),
    Method('POST'),
    Payload(payload),
  );
}
