import { generateGid, hasPrefix, ObjectPrefixEnum, resolveGidPrefix } from '@utils/gid-factory';
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

describe('resolveGidPrefix', () => {
  it('returns the object prefix of a generated identifier', () => {
    const gid = generateGid(ObjectPrefixEnum.INVOICE);

    const result = resolveGidPrefix(gid);

    expect(result).toBe(ObjectPrefixEnum.INVOICE);
  });

  it('keeps an underscore that belongs to the prefix', () => {
    const gid = generateGid(ObjectPrefixEnum.SUBSCRIPTION_SCHEDULE);

    const result = resolveGidPrefix(gid);

    expect(result).toBe(ObjectPrefixEnum.SUBSCRIPTION_SCHEDULE);
  });

  it('returns an empty prefix for an identifier without one', () => {
    const result = resolveGidPrefix('01h455vb4pex5vsknk084sn02q');

    expect(result).toBe('');
  });
});
