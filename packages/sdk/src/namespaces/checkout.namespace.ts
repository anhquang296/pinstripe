import type { PinstripeTransport } from '@client/pinstripe-transport';
import { CheckoutSessionsResource } from '@resources/checkout/sessions.resource';

export class CheckoutNamespace {
  readonly sessions: CheckoutSessionsResource;

  constructor(transport: PinstripeTransport) {
    this.sessions = new CheckoutSessionsResource(transport);
  }
}
