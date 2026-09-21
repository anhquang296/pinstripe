import { cursorSearchParams } from '@common/hooks/useCursorPagination';
import { UserRoleEnum } from '@vxrerp/platform/contracts';
import { values } from 'lodash-es';
import { parseAsString, parseAsStringEnum } from 'nuqs';

export const userSearchParams = {
  ...cursorSearchParams,
  role: parseAsStringEnum(values(UserRoleEnum)),
  q: parseAsString,
};
