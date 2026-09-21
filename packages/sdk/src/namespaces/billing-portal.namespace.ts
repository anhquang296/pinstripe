import type { VxrErpTransport } from '@client/vxr-erp-transport';
import { BillingPortalConfigurationsResource } from '@resources/billing-portal/configurations.resource';
import { BillingPortalSessionsResource } from '@resources/billing-portal/sessions.resource';

export class BillingPortalNamespace {
  readonly configurations: BillingPortalConfigurationsResource;
  readonly sessions: BillingPortalSessionsResource;

  constructor(transport: VxrErpTransport) {
    this.configurations = new BillingPortalConfigurationsResource(transport);
    this.sessions = new BillingPortalSessionsResource(transport);
  }
}
