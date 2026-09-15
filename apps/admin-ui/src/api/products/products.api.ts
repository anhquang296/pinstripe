import type {
  CreateProductPayload,
  GetProductsQuery,
  ListResponse,
  Product,
  UpdateProductPayload,
} from '@pinstripe/core/contracts';
import { Endpoint, Method, Params, Payload, Request } from '@api/request';

const PRODUCTS_PATH = '/v1/products';

export function getProducts(query: GetProductsQuery = {}): Promise<ListResponse<Product>> {
  return Request<ListResponse<Product>>(
    Endpoint(PRODUCTS_PATH),
    Method('GET'),
    Params(query as Record<string, unknown>),
  );
}

export function getProduct(productId: string): Promise<Product> {
  return Request<Product>(
    Endpoint(`${PRODUCTS_PATH}/${encodeURIComponent(productId)}`),
    Method('GET'),
  );
}

export function createProduct(payload: CreateProductPayload): Promise<Product> {
  return Request<Product>(
    Endpoint(PRODUCTS_PATH),
    Method('POST'),
    Payload(payload as Record<string, unknown>),
  );
}

export function updateProduct(productId: string, payload: UpdateProductPayload): Promise<Product> {
  return Request<Product>(
    Endpoint(`${PRODUCTS_PATH}/${encodeURIComponent(productId)}`),
    Method('POST'),
    Payload(payload as Record<string, unknown>),
  );
}
