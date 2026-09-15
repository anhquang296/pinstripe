import { generateId, hasPrefix, ObjectPrefixEnum } from '@utils/id-factory';
import { describe, expect, it } from 'vitest';

describe('generateId', () => {
  it('prefixes the identifier with the object prefix', () => {
    const id = generateId(ObjectPrefixEnum.CUSTOMER);

    expect(hasPrefix(id, ObjectPrefixEnum.CUSTOMER)).toBe(true);
  });

  it('produces a distinct identifier on every call', () => {
    const ids = new Set(
      Array.from({ length: 1000 }, () => {
        return generateId(ObjectPrefixEnum.INVOICE);
      }),
    );

    expect(ids.size).toBe(1000);
  });
});
