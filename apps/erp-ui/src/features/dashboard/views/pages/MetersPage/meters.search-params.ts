import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { MeterStatusEnum } from '@vxrerp/billing/contracts';
import { values } from 'lodash-es';
import { parseAsStringEnum } from 'nuqs';

export const meterSearchParams = {
  ...cursorSearchParams,
  status: parseAsStringEnum(values(MeterStatusEnum)),
};
