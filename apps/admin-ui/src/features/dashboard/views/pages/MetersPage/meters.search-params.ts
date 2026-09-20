import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { MeterStatusEnum } from '@pinstripe/core/contracts';
import { values } from 'lodash-es';
import { parseAsStringEnum } from 'nuqs';

export const meterSearchParams = {
  ...cursorSearchParams,
  status: parseAsStringEnum(values(MeterStatusEnum)),
};
