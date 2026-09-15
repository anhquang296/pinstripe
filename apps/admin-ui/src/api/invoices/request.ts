import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  CreateInvoicePayload,
  GetInvoicesQuery,
  GetUpcomingInvoiceQuery,
  InvoiceResponse,
  ListResponse,
  PayInvoicePayload,
  RatedInvoiceResponse,
  VoidInvoicePayload,
} from './type';

const INVOICES_PATH = '/v1/invoices';
const UPCOMING_INVOICE_PATH = '/v1/invoices/upcoming';

export function getUpcomingInvoice(query: GetUpcomingInvoiceQuery): Promise<RatedInvoiceResponse> {
  return Request<RatedInvoiceResponse>(
    Endpoint(UPCOMING_INVOICE_PATH),
    Method('GET'),
    Params(query),
  );
}

export function getInvoices(query: GetInvoicesQuery = {}): Promise<ListResponse<InvoiceResponse>> {
  return Request<ListResponse<InvoiceResponse>>(
    Endpoint(INVOICES_PATH),
    Method('GET'),
    Params(query),
  );
}

export function getInvoice(invoiceId: string): Promise<InvoiceResponse> {
  return Request<InvoiceResponse>(
    Endpoint(`${INVOICES_PATH}/${encodeURIComponent(invoiceId)}`),
    Method('GET'),
  );
}

export function createInvoice(payload: CreateInvoicePayload): Promise<InvoiceResponse> {
  return Request<InvoiceResponse>(Endpoint(INVOICES_PATH), Method('POST'), Payload(payload));
}

export function finalizeInvoice(invoiceId: string): Promise<InvoiceResponse> {
  return Request<InvoiceResponse>(
    Endpoint(`${INVOICES_PATH}/${encodeURIComponent(invoiceId)}/finalize`),
    Method('POST'),
    Payload({}),
  );
}

export function payInvoice(
  invoiceId: string,
  payload: PayInvoicePayload,
): Promise<InvoiceResponse> {
  return Request<InvoiceResponse>(
    Endpoint(`${INVOICES_PATH}/${encodeURIComponent(invoiceId)}/pay`),
    Method('POST'),
    Payload(payload),
  );
}

export function voidInvoice(
  invoiceId: string,
  payload: VoidInvoicePayload,
): Promise<InvoiceResponse> {
  return Request<InvoiceResponse>(
    Endpoint(`${INVOICES_PATH}/${encodeURIComponent(invoiceId)}/void`),
    Method('POST'),
    Payload(payload),
  );
}
