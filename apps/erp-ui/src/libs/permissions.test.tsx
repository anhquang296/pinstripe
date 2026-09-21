import { renderHook } from '@testing-library/react';
import type { Permission } from '@vxrerp/platform/contracts';
import { PermissionEnum } from '@vxrerp/platform/contracts';
import { describe, expect, it, vi } from 'vitest';

import { useCan } from './permissions';

const { useAccountQuery } = vi.hoisted(() => {
  return { useAccountQuery: vi.fn() };
});

vi.mock('@vxrerp/sdk/react', () => {
  return { useAccountQuery };
});

function setup(permissions?: Permission[]) {
  useAccountQuery.mockReturnValue({ data: permissions ? { permissions } : undefined });
}

describe('useCan', () => {
  it('grants a permission the account carries', () => {
    setup([PermissionEnum.BILLING_READ, PermissionEnum.LEDGER_WRITE]);

    const { result } = renderHook(() => {
      return useCan(PermissionEnum.LEDGER_WRITE);
    });

    expect(result.current).toBe(true);
  });

  it('denies a permission the account does not carry', () => {
    setup([PermissionEnum.BILLING_READ]);

    const { result } = renderHook(() => {
      return useCan(PermissionEnum.USER_MANAGE);
    });

    expect(result.current).toBe(false);
  });

  it('denies every permission while the account has not loaded', () => {
    setup();

    const { result } = renderHook(() => {
      return useCan(PermissionEnum.BILLING_READ);
    });

    expect(result.current).toBe(false);
  });
});
