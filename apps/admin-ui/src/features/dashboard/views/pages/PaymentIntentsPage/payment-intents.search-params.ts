import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { PaymentIntentStatusEnum } from '@pinstripe/core/contracts';
import { values } from 'lodash-es';
import { parseAsString, parseAsStringEnum } from 'nuqs';

export const paymentIntentSearchParams = {
  ...cursorSearchParams,
  status: parseAsStringEnum(values(PaymentIntentStatusEnum)),
  invoiceId: parseAsString,
};
