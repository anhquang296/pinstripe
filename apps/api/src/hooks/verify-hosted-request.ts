import { UnauthorizedError } from '@pinstripe/core/errors';
import type { FastifyReply, FastifyRequest } from 'fastify';
import _ from 'lodash';

export async function verifyHostedRequest(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token: unknown = _.get(request.query, 'token');

  if (_.isString(token) && !_.isEmpty(token)) {
    return;
  }

  throw new UnauthorizedError('A hosted page is only reachable through its signed link');
}
