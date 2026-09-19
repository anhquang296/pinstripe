import { afterEach, describe, expect, it, vi } from 'vitest';

import { testClockFormDataToPayload } from './test-clock-form';

afterEach(() => {
  vi.useRealTimers();
});

describe('testClockFormDataToPayload', () => {
  it('dùng mốc người dùng chọn khi form có frozenTime', () => {
    const result = testClockFormDataToPayload({
      name: 'Demo kế toán',
      frozenTime: '2026-09-19T08:30',
    });

    expect(result).toEqual({
      name: 'Demo kế toán',
      frozenTime: new Date('2026-09-19T08:30').toISOString(),
    });
  });

  it('lấy thời điểm hiện tại khi form bỏ trống frozenTime', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T00:00:00.000Z'));

    const result = testClockFormDataToPayload({ name: 'Demo kế toán', frozenTime: '' });

    expect(result).toEqual({
      name: 'Demo kế toán',
      frozenTime: '2026-09-19T00:00:00.000Z',
    });
  });
});
