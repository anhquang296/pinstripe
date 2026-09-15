import type {
  CreateCustomerPayload,
  Customer,
  GetCustomersQuery,
  ListResponse,
  UpdateCustomerPayload,
} from '@pinstripe/core/contracts';
import { Endpoint, Method, Params, Payload, Request } from '@api/request';

const CUSTOMERS_PATH = '/v1/customers';

export function getCustomers(query: GetCustomersQuery = {}): Promise<ListResponse<Customer>> {
  return Request<ListResponse<Customer>>(
    Endpoint(CUSTOMERS_PATH),
    Method('GET'),
    Params(query as Record<string, unknown>),
  );
}

export function getCustomer(customerId: string): Promise<Customer> {
  return Request<Customer>(
    Endpoint(`${CUSTOMERS_PATH}/${encodeURIComponent(customerId)}`),
    Method('GET'),
  );
}

export function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  return Request<Customer>(
    Endpoint(CUSTOMERS_PATH),
    Method('POST'),
    Payload(payload as Record<string, unknown>),
  );
}

export function updateCustomer(
  customerId: string,
  payload: UpdateCustomerPayload,
): Promise<Customer> {
  return Request<Customer>(
    Endpoint(`${CUSTOMERS_PATH}/${encodeURIComponent(customerId)}`),
    Method('POST'),
    Payload(payload as Record<string, unknown>),
  );
}
