import { QueueNameEnum } from '@vxrerp/platform/queues';

export const TAX_QUEUE = QueueNameEnum.TAX;
export const TAX_ID_VERIFY_JOB = 'TaxIdVerify';

export interface TaxIdVerifyJob {
  taxIdId: string;
}

export function buildTaxIdVerifyJob(taxIdId: string): TaxIdVerifyJob {
  return { taxIdId };
}
