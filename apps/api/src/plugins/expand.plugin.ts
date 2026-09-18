import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import _ from 'lodash';

function readExpand(request: FastifyRequest): string[] {
  const expand = _.get(request.query, 'expand');

  return _.filter(_.castArray(expand), _.isString);
}

export const expandPlugin = fp(async (fastify) => {
  fastify.addHook('preSerialization', async (request, reply, payload) => {
    if (reply.statusCode >= 400) {
      return payload;
    }

    const expand = readExpand(request);

    if (_.isEmpty(expand)) {
      return payload;
    }

    return fastify.expansionService.expandResponse(payload, expand);
  });
});
