import { describe, expect, it } from 'vitest';

import { advanceTestClockFormDataToPayload } from './advance-test-clock-form';

describe('advanceTestClockFormDataToPayload', () => {
  it('đổi mốc datetime-local sang ISO', () => {
    const result = advanceTestClockFormDataToPayload({ frozenTime: '2026-10-01T09:15' });

    expect(result).toEqual({ frozenTime: new Date('2026-10-01T09:15').toISOString() });
  });
});
