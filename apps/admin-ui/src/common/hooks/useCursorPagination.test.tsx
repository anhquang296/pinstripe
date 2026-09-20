import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { useCursorPagination } from './useCursorPagination';

function setup(initialAfter: string | null = null) {
  return renderHook(() => {
    const [after, setAfter] = useState<string | null>(initialAfter);

    const pagination = useCursorPagination({ after, onPageChange: setAfter });

    return { ...pagination, after, setAfter };
  });
}

describe('useCursorPagination', () => {
  it('has no previous page on a fresh mount at the first page', () => {
    const { result } = setup();

    expect(result.current.hasPrevious).toBe(false);
    expect(result.current.after).toBeNull();
  });

  it('has no previous page on a fresh mount deep-linked to a cursor', () => {
    const { result } = setup('sub_page3');

    expect(result.current.hasPrevious).toBe(false);
  });

  it('walks forward and back to the first page', () => {
    const { result } = setup();

    act(() => {
      result.current.advancePage('sub_20');
    });

    expect(result.current.after).toBe('sub_20');
    expect(result.current.hasPrevious).toBe(true);

    act(() => {
      result.current.advancePage('sub_40');
    });

    expect(result.current.after).toBe('sub_40');

    act(() => {
      result.current.revertPage();
    });

    expect(result.current.after).toBe('sub_20');

    act(() => {
      result.current.revertPage();
    });

    expect(result.current.after).toBeNull();
    expect(result.current.hasPrevious).toBe(false);
  });

  it('has no previous page once a filter write resets the cursor', () => {
    const { result } = setup();

    act(() => {
      result.current.advancePage('sub_20');
    });

    expect(result.current.hasPrevious).toBe(true);

    act(() => {
      result.current.setAfter(null);
    });

    expect(result.current.hasPrevious).toBe(false);
  });
});
