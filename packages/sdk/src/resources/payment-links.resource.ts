import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreatePaymentLinkPayload,
  FindPaymentLinksQuery,
  ListResponse,
  PaymentLinkResponse,
  UpdatePaymentLinkPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PAYMENT_LINKS_PATH = '/v1/payment_links';

export class PaymentLinksResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindPaymentLinksQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<PaymentLinkResponse>> {
    return this._transport.request({
      path: PAYMENT_LINKS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(paymentLinkId: string, options?: RequestOptions): Promise<PaymentLinkResponse> {
    return this._transport.request({
      path: buildPath(PAYMENT_LINKS_PATH, paymentLinkId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreatePaymentLinkPayload,
    options?: RequestOptions,
  ): Promise<PaymentLinkResponse> {
    return this._transport.request({
      path: PAYMENT_LINKS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    paymentLinkId: string,
    payload: UpdatePaymentLinkPayload,
    options?: RequestOptions,
  ): Promise<PaymentLinkResponse> {
    return this._transport.request({
      path: buildPath(PAYMENT_LINKS_PATH, paymentLinkId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
