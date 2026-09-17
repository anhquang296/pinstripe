import type { PinstripeTransport } from '@client/pinstripe-transport';
import { MeterEventBatchesResource } from '@resources/billing/meter-event-batches.resource';
import { MeterEventsResource } from '@resources/billing/meter-events.resource';
import { MetersResource } from '@resources/billing/meters.resource';

export class BillingNamespace {
  readonly meters: MetersResource;
  readonly meterEvents: MeterEventsResource;
  readonly meterEventBatches: MeterEventBatchesResource;

  constructor(transport: PinstripeTransport) {
    this.meters = new MetersResource(transport);
    this.meterEvents = new MeterEventsResource(transport);
    this.meterEventBatches = new MeterEventBatchesResource(transport);
  }
}
