import type { VxrErpTransport } from '@client/vxr-erp-transport';
import { CheckoutSessionsResource } from '@resources/checkout/sessions.resource';

export class CheckoutNamespace {
  readonly sessions: CheckoutSessionsResource;

  constructor(transport: VxrErpTransport) {
    this.sessions = new CheckoutSessionsResource(transport);
  }
}
