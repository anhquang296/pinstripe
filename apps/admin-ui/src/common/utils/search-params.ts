import { isNull, omitBy } from 'lodash-es';
import { parseAsBoolean } from 'nuqs';

export type SearchQuery<TSearch> = { [TKey in keyof TSearch]?: Exclude<TSearch[TKey], null> };

export function toQuery<TSearch extends object>(search: TSearch): SearchQuery<TSearch> {
  return omitBy(search, isNull) as SearchQuery<TSearch>;
}

export function toBooleanSelectValue(value: boolean | null): string | null {
  return isNull(value) ? null : parseAsBoolean.serialize(value);
}

export function toBooleanFilter(value: string | null): boolean | null {
  return isNull(value) ? null : parseAsBoolean.parse(value);
}
