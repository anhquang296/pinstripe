import type { DisputeReason } from '@contracts/disputes.types';
import { DisputeReasonEnum } from '@contracts/disputes.types';
import _ from 'lodash';

const PSP_DISPUTE_REASONS: Record<string, DisputeReason> = {
  fraudulent: DisputeReasonEnum.FRAUDULENT,
  unauthorized: DisputeReasonEnum.FRAUDULENT,
  duplicate: DisputeReasonEnum.DUPLICATE,
  product_not_received: DisputeReasonEnum.PRODUCT_NOT_RECEIVED,
  product_unacceptable: DisputeReasonEnum.PRODUCT_NOT_RECEIVED,
  subscription_canceled: DisputeReasonEnum.SUBSCRIPTION_CANCELED,
  credit_not_processed: DisputeReasonEnum.CREDIT_NOT_PROCESSED,
  general: DisputeReasonEnum.GENERAL,
};

export function mapPspDisputeReason(rawReason: string | null): DisputeReason {
  if (!rawReason) {
    return DisputeReasonEnum.GENERAL;
  }

  return _.get(PSP_DISPUTE_REASONS, rawReason, DisputeReasonEnum.GENERAL);
}
