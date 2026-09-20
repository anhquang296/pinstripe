import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useSearchPreservingNavigate() {
  const navigate = useNavigate();
  const { search } = useLocation();

  return useCallback(
    (pathname: string) => {
      navigate({ pathname, search });
    },
    [navigate, search],
  );
}
