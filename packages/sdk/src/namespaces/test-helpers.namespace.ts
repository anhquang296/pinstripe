import type { PinstripeTransport } from '@client/pinstripe-transport';
import { TestClocksResource } from '@resources/test-helpers/test-clocks.resource';

export class TestHelpersNamespace {
  readonly testClocks: TestClocksResource;

  constructor(transport: PinstripeTransport) {
    this.testClocks = new TestClocksResource(transport);
  }
}
