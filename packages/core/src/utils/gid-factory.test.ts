import { generateGid, hasPrefix, ObjectPrefixEnum } from '@utils/gid-factory';
import { describe, expect, it } from 'vitest';

const GID_SUFFIX_PATTERN = /^[0-9a-hjkmnp-tv-z]{26}$/;

describe('generateGid', () => {
  it('prefixes the identifier with the object prefix', () => {
    const gid = generateGid(ObjectPrefixEnum.CUSTOMER);

    expect(hasPrefix(gid, ObjectPrefixEnum.CUSTOMER)).toBe(true);
  });

  it('prefixes the identifier with a prefix that contains an underscore', () => {
    const gid = generateGid(ObjectPrefixEnum.SUBSCRIPTION_SCHEDULE);

    expect(hasPrefix(gid, ObjectPrefixEnum.SUBSCRIPTION_SCHEDULE)).toBe(true);
  });

  it('produces a suffix of 26 base32 characters', () => {
    const gid = generateGid(ObjectPrefixEnum.INVOICE);
    const suffix = gid.slice(`${ObjectPrefixEnum.INVOICE}_`.length);

    expect(suffix).toMatch(GID_SUFFIX_PATTERN);
  });

  it('produces a distinct identifier on every call', () => {
    const gids = new Set(
      Array.from({ length: 1000 }, () => {
        return generateGid(ObjectPrefixEnum.INVOICE);
      }),
    );

    expect(gids.size).toBe(1000);
  });

  it('produces identifiers that sort in generation order', () => {
    const gids = Array.from({ length: 1000 }, () => {
      return generateGid(ObjectPrefixEnum.INVOICE);
    });

    expect(gids).toEqual([...gids].sort());
  });
});
