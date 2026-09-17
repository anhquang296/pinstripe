import type {
  InvoiceResponse,
  ListResponse,
  SubscriptionResponse,
} from '@pinstripe/core/contracts';

const DEFAULT_API_URL = 'http://localhost:3000';
const PAGE_LIMIT = 20;

export class PortalApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'PortalApiError';
  }
}

async function request<T>(path: string): Promise<T> {
  const baseUrl = process.env.PINSTRIPE_API_URL ?? DEFAULT_API_URL;
  const apiKey = process.env.PINSTRIPE_SECRET_API_KEY ?? '';
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new PortalApiError(response.status, `Billing API answered ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getSubscriptions(customerId: string): Promise<ListResponse<SubscriptionResponse>> {
  return request<ListResponse<SubscriptionResponse>>(
    `/v1/subscriptions?customerId=${encodeURIComponent(customerId)}&limit=${PAGE_LIMIT}`,
  );
}

export function getInvoices(customerId: string): Promise<ListResponse<InvoiceResponse>> {
  return request<ListResponse<InvoiceResponse>>(
    `/v1/invoices?customerId=${encodeURIComponent(customerId)}&limit=${PAGE_LIMIT}`,
  );
}
