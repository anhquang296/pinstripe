import { dropRight, isEmpty, last } from 'lodash-es';
import { useCallback, useState } from 'react';

export interface CursorPaginationResult {
  after: string | undefined;
  hasPrevious: boolean;
  advancePage: (lastId: string) => void;
  revertPage: () => void;
  resetPage: () => void;
}

export function useCursorPagination(): CursorPaginationResult {
  const [cursors, setCursors] = useState<string[]>([]);

  const advancePage = useCallback((lastId: string) => {
    setCursors((currentCursors) => {
      return [...currentCursors, lastId];
    });
  }, []);

  const revertPage = useCallback(() => {
    setCursors((currentCursors) => {
      return dropRight(currentCursors);
    });
  }, []);

  const resetPage = useCallback(() => {
    setCursors([]);
  }, []);

  return {
    after: last(cursors),
    hasPrevious: !isEmpty(cursors),
    advancePage,
    revertPage,
    resetPage,
  };
}
