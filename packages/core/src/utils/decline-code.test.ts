import { DeclineCodeEnum, DeclineKindEnum } from '@contracts/payments.types';
import { describe, expect, it } from 'vitest';

import { mapPspDeclineCode, resolveDeclineKind, resolveRetryDelayDays } from './decline-code';

const FALLBACK_SCHEDULE = [1, 3, 5, 7] as const;

describe('mapPspDeclineCode', () => {
  it.each([
    { raw: 'insufficient_funds', expected: DeclineCodeEnum.INSUFFICIENT_FUNDS },
    { raw: 'card_declined', expected: DeclineCodeEnum.GENERIC_DECLINE },
    { raw: 'invalid_cvc', expected: DeclineCodeEnum.INCORRECT_CVC },
    { raw: 'merchant_blacklist', expected: DeclineCodeEnum.FRAUDULENT },
    { raw: 'restricted_card', expected: DeclineCodeEnum.PICKUP_CARD },
  ])('maps the processor code $raw onto $expected', ({ raw, expected }) => {
    expect(mapPspDeclineCode(raw)).toBe(expected);
  });

  it('falls back to a generic decline for a code the taxonomy has never seen', () => {
    expect(mapPspDeclineCode('issuer_ate_the_card')).toBe(DeclineCodeEnum.GENERIC_DECLINE);
  });

  it('falls back to a generic decline when the processor sent no code at all', () => {
    expect(mapPspDeclineCode(null)).toBe(DeclineCodeEnum.GENERIC_DECLINE);
  });
});

describe('resolveDeclineKind', () => {
  it('reads a stolen card as a hard decline', () => {
    expect(resolveDeclineKind(DeclineCodeEnum.STOLEN_CARD)).toBe(DeclineKindEnum.HARD);
  });

  it('reads insufficient funds as a soft decline', () => {
    expect(resolveDeclineKind(DeclineCodeEnum.INSUFFICIENT_FUNDS)).toBe(DeclineKindEnum.SOFT);
  });

  it('treats an unknown decline as soft so the invoice still gets another chance', () => {
    expect(resolveDeclineKind(null)).toBe(DeclineKindEnum.SOFT);
  });
});

describe('resolveRetryDelayDays', () => {
  it('never retries a hard decline, however early the attempt', () => {
    expect(resolveRetryDelayDays(DeclineCodeEnum.LOST_CARD, 1, FALLBACK_SCHEDULE)).toBeNull();
  });

  it('uses the schedule the decline code carries rather than the fallback', () => {
    expect(resolveRetryDelayDays(DeclineCodeEnum.INSUFFICIENT_FUNDS, 1, FALLBACK_SCHEDULE)).toBe(3);
  });

  it('walks the schedule forward as the attempts pile up', () => {
    expect(resolveRetryDelayDays(DeclineCodeEnum.INSUFFICIENT_FUNDS, 3, FALLBACK_SCHEDULE)).toBe(7);
  });

  it('returns null once the schedule for that decline code runs out', () => {
    expect(resolveRetryDelayDays(DeclineCodeEnum.INSUFFICIENT_FUNDS, 4, FALLBACK_SCHEDULE)).toBe(
      null,
    );
  });

  it('gives an expired card exactly one slow retry', () => {
    expect(resolveRetryDelayDays(DeclineCodeEnum.EXPIRED_CARD, 1, FALLBACK_SCHEDULE)).toBe(7);
    expect(resolveRetryDelayDays(DeclineCodeEnum.EXPIRED_CARD, 2, FALLBACK_SCHEDULE)).toBeNull();
  });

  it('falls back to the configured schedule when there is no decline code to go on', () => {
    expect(resolveRetryDelayDays(null, 1, FALLBACK_SCHEDULE)).toBe(1);
    expect(resolveRetryDelayDays(null, 4, FALLBACK_SCHEDULE)).toBe(7);
    expect(resolveRetryDelayDays(null, 5, FALLBACK_SCHEDULE)).toBeNull();
  });
});
