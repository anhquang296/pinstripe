import { describe, expect, it } from 'vitest';
import { FrozenClock } from '@utils/clock';

describe('FrozenClock', () => {
  it('returns the same instant until it is advanced', () => {
    const clock = new FrozenClock(new Date('2026-01-01T00:00:00.000Z'));

    const first = clock.now();
    const second = clock.now();

    expect(first.toISOString()).toBe(second.toISOString());
  });

  it('moves forward by the given number of milliseconds', () => {
    const clock = new FrozenClock(new Date('2026-01-01T00:00:00.000Z'));

    clock.advanceBy(60_000);

    expect(clock.now().toISOString()).toBe('2026-01-01T00:01:00.000Z');
  });

  it('refuses to move backwards because billing history must not be rewritten', () => {
    const clock = new FrozenClock(new Date('2026-01-01T00:00:00.000Z'));

    const act = () => clock.advanceTo(new Date('2025-12-31T00:00:00.000Z'));

    expect(act).toThrowError(/cannot move backwards/);
  });
});
