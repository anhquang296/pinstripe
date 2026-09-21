import { dropRight, isEmpty, isNull, last } from 'lodash-es';
import { parseAsString } from 'nuqs';
import { useCallback, useState } from 'react';

export const cursorSearchParams = { after: parseAsString };

interface CursorPaginationProps {
  after: string | null;
  onPageChange: (after: string | null) => void;
}

export interface CursorPaginationResult {
  hasPrevious: boolean;
  advancePage: (lastId: string) => void;
  revertPage: () => void;
}

export function useCursorPagination({
  after,
  onPageChange,
}: CursorPaginationProps): CursorPaginationResult {
  const [previousCursors, setPreviousCursors] = useState<(string | null)[]>([]);

  const advancePage = useCallback(
    (lastId: string) => {
      setPreviousCursors([...previousCursors, after]);
      onPageChange(lastId);
    },
    [previousCursors, after, onPageChange],
  );

  const revertPage = useCallback(() => {
    onPageChange(last(previousCursors) ?? null);
    setPreviousCursors(dropRight(previousCursors));
  }, [previousCursors, onPageChange]);

  return {
    hasPrevious: !isNull(after) && !isEmpty(previousCursors),
    advancePage,
    revertPage,
  };
}
