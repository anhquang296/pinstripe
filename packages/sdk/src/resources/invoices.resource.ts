import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateInvoicePayload,
  FindInvoicesQuery,
  GetUpcomingInvoiceQuery,
  InvoiceResponse,
  ListResponse,
  PayInvoicePayload,
  RatedInvoiceResponse,
  VoidInvoicePayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const INVOICES_PATH = '/v1/invoices';

export class InvoicesResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindInvoicesQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<InvoiceResponse>> {
    return this._transport.request({
      path: INVOICES_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(invoiceId: string, options?: RequestOptions): Promise<InvoiceResponse> {
    return this._transport.request({
      path: buildPath(INVOICES_PATH, invoiceId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  getUpcoming(
    query: GetUpcomingInvoiceQuery,
    options?: RequestOptions,
  ): Promise<RatedInvoiceResponse> {
    return this._transport.request({
      path: `${INVOICES_PATH}/upcoming`,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  create(payload: CreateInvoicePayload, options?: RequestOptions): Promise<InvoiceResponse> {
    return this._transport.request({
      path: INVOICES_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  finalize(invoiceId: string, options?: RequestOptions): Promise<InvoiceResponse> {
    return this._transport.request({
      path: buildPath(INVOICES_PATH, invoiceId, 'finalize'),
      method: HttpMethodEnum.POST,
      options,
    });
  }

  pay(
    invoiceId: string,
    payload: PayInvoicePayload = {},
    options?: RequestOptions,
  ): Promise<InvoiceResponse> {
    return this._transport.request({
      path: buildPath(INVOICES_PATH, invoiceId, 'pay'),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  void(
    invoiceId: string,
    payload: VoidInvoicePayload = {},
    options?: RequestOptions,
  ): Promise<InvoiceResponse> {
    return this._transport.request({
      path: buildPath(INVOICES_PATH, invoiceId, 'void'),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
