import type { DeclineCode, DeclineKind } from '@contracts/payments.types';
import { DECLINE_TAXONOMY, DeclineCodeEnum, DeclineKindEnum } from '@contracts/payments.types';
import _ from 'lodash';

const PSP_DECLINE_CODES: Record<string, DeclineCode> = {
  insufficient_funds: DeclineCodeEnum.INSUFFICIENT_FUNDS,
  card_declined: DeclineCodeEnum.GENERIC_DECLINE,
  generic_decline: DeclineCodeEnum.GENERIC_DECLINE,
  do_not_honor: DeclineCodeEnum.DO_NOT_HONOR,
  transaction_not_allowed: DeclineCodeEnum.DO_NOT_HONOR,
  try_again_later: DeclineCodeEnum.TRY_AGAIN_LATER,
  issuer_not_available: DeclineCodeEnum.TRY_AGAIN_LATER,
  reenter_transaction: DeclineCodeEnum.TRY_AGAIN_LATER,
  processing_error: DeclineCodeEnum.PROCESSING_ERROR,
  expired_card: DeclineCodeEnum.EXPIRED_CARD,
  incorrect_cvc: DeclineCodeEnum.INCORRECT_CVC,
  invalid_cvc: DeclineCodeEnum.INCORRECT_CVC,
  lost_card: DeclineCodeEnum.LOST_CARD,
  stolen_card: DeclineCodeEnum.STOLEN_CARD,
  fraudulent: DeclineCodeEnum.FRAUDULENT,
  merchant_blacklist: DeclineCodeEnum.FRAUDULENT,
  pickup_card: DeclineCodeEnum.PICKUP_CARD,
  restricted_card: DeclineCodeEnum.PICKUP_CARD,
  invalid_account: DeclineCodeEnum.INVALID_ACCOUNT,
  no_account: DeclineCodeEnum.INVALID_ACCOUNT,
  currency_not_supported: DeclineCodeEnum.CURRENCY_NOT_SUPPORTED,
  authentication_required: DeclineCodeEnum.AUTHENTICATION_REQUIRED,
};

export function mapPspDeclineCode(rawDeclineCode: string | null): DeclineCode {
  if (!rawDeclineCode) {
    return DeclineCodeEnum.GENERIC_DECLINE;
  }

  return _.get(PSP_DECLINE_CODES, rawDeclineCode, DeclineCodeEnum.GENERIC_DECLINE);
}

export function resolveDeclineKind(declineCode: DeclineCode | null): DeclineKind {
  if (!declineCode) {
    return DeclineKindEnum.SOFT;
  }

  return _.get(DECLINE_TAXONOMY, [declineCode, 'kind'], DeclineKindEnum.SOFT);
}

export function resolveRetryDelayDays(
  declineCode: DeclineCode | null,
  attemptCount: number,
  fallbackDelayDays: readonly number[],
): number | null {
  if (resolveDeclineKind(declineCode) === DeclineKindEnum.HARD) {
    return null;
  }

  const schedule = declineCode
    ? _.get(DECLINE_TAXONOMY, [declineCode, 'retryDelayDays'], fallbackDelayDays)
    : fallbackDelayDays;
  const delayDays = _.get(schedule, attemptCount - 1, null);

  return delayDays;
}
