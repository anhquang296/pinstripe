import { parse } from 'node:querystring';

import _ from 'lodash';

const ARRAY_SUFFIX = '[]';

export function parseQuerystring(query: string): Record<string, unknown> {
  const parsed = parse(query);
  const normalized: Record<string, unknown> = {};

  _.forEach(parsed, (value, key) => {
    if (_.endsWith(key, ARRAY_SUFFIX)) {
      normalized[key.slice(0, -ARRAY_SUFFIX.length)] = _.castArray(value);

      return;
    }

    normalized[key] = value;
  });

  return normalized;
}
