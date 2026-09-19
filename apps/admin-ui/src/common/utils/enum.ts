import { find, values } from 'lodash-es';

export function toEnumMember<TEnum extends Record<string, string>>(
  enumObject: TEnum,
  value: string,
  fallback: TEnum[keyof TEnum],
): TEnum[keyof TEnum] {
  const matched = find(values(enumObject), (candidate) => {
    return candidate === value;
  }) as TEnum[keyof TEnum] | undefined;

  if (matched) {
    return matched;
  }

  return fallback;
}
