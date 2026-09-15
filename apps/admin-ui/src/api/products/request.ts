import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  CreateProductPayload,
  GetProductsQuery,
  ListResponse,
  ProductResponse,
  UpdateProductPayload,
} from './type';

const PRODUCTS_PATH = '/v1/products';

export function getProducts(query: GetProductsQuery = {}): Promise<ListResponse<ProductResponse>> {
  return Request<ListResponse<ProductResponse>>(
    Endpoint(PRODUCTS_PATH),
    Method('GET'),
    Params(query),
  );
}

export function getProduct(productId: string): Promise<ProductResponse> {
  return Request<ProductResponse>(
    Endpoint(`${PRODUCTS_PATH}/${encodeURIComponent(productId)}`),
    Method('GET'),
  );
}

export function createProduct(payload: CreateProductPayload): Promise<ProductResponse> {
  return Request<ProductResponse>(Endpoint(PRODUCTS_PATH), Method('POST'), Payload(payload));
}

export function updateProduct(
  productId: string,
  payload: UpdateProductPayload,
): Promise<ProductResponse> {
  return Request<ProductResponse>(
    Endpoint(`${PRODUCTS_PATH}/${encodeURIComponent(productId)}`),
    Method('POST'),
    Payload(payload),
  );
}
