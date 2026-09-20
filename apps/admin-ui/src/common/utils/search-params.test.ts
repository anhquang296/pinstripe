import { describe, expect, it } from 'vitest';

import { toBooleanFilter, toBooleanSelectValue, toQuery } from './search-params';

describe('toQuery', () => {
  it('drops keys whose value is null', () => {
    const result = toQuery({ after: null, status: 'active' });

    expect(result).toEqual({ status: 'active' });
  });

  it('keeps a false value', () => {
    const result = toQuery({ active: false });

    expect(result).toEqual({ active: false });
  });

  it('keeps an empty string', () => {
    const result = toQuery({ email: '' });

    expect(result).toEqual({ email: '' });
  });
});

describe('toBooleanSelectValue', () => {
  it.each([
    { value: true, expected: 'true' },
    { value: false, expected: 'false' },
    { value: null, expected: null },
  ])('turns $value into $expected', ({ value, expected }) => {
    expect(toBooleanSelectValue(value)).toBe(expected);
  });
});

describe('toBooleanFilter', () => {
  it.each([
    { value: 'true', expected: true },
    { value: 'false', expected: false },
    { value: null, expected: null },
  ])('turns $value into $expected', ({ value, expected }) => {
    expect(toBooleanFilter(value)).toBe(expected);
  });
});
