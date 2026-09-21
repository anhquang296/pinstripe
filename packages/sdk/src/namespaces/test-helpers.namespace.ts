import type { VxrErpTransport } from '@client/vxr-erp-transport';
import { TestClocksResource } from '@resources/test-helpers/test-clocks.resource';

export class TestHelpersNamespace {
  readonly testClocks: TestClocksResource;

  constructor(transport: VxrErpTransport) {
    this.testClocks = new TestClocksResource(transport);
  }
}
