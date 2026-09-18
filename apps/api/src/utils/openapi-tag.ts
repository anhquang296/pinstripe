import type { RouteOptions } from 'fastify';
import _ from 'lodash';

export function tagRouteByPrefix(
  routeOptions: RouteOptions & { prefix: string },
  surfacePrefix: string,
): void {
  const { prefix, schema } = routeOptions;
  const resourcePath = prefix.slice(surfacePrefix.length);

  if (schema && resourcePath) {
    const { tags = [_.startCase(resourcePath)] } = schema;

    routeOptions.schema = { ...schema, tags };
  }
}
