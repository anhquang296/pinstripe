import { AppError, ErrorTypeEnum } from '@pinstripe/core/errors';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

interface StripeShapedError {
  error: {
    type: string;
    code?: string;
    param?: string;
    message: string;
    requestId: string;
  };
}

function buildErrorBody(
  type: string,
  message: string,
  requestId: string,
  code?: string,
  param?: string,
): StripeShapedError {
  return { error: { type, code, param, message, requestId } };
}

export const errorHandlerPlugin = fp(async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      request.log.error(
        { error, statusCode: error.statusCode },
        'setErrorHandler() request rejected error',
      );

      return reply
        .code(error.statusCode)
        .send(buildErrorBody(error.type, error.message, request.id, error.code, error.param));
    }

    if (error.validation) {
      request.log.error({ error }, 'setErrorHandler() request failed validation error');

      return reply
        .code(400)
        .send(
          buildErrorBody(
            ErrorTypeEnum.INVALID_REQUEST,
            error.message,
            request.id,
            'parameter_invalid',
          ),
        );
    }

    request.log.error({ error }, 'setErrorHandler() error');

    return reply
      .code(error.statusCode ?? 500)
      .send(buildErrorBody(ErrorTypeEnum.API, 'An unexpected error occurred', request.id));
  });

  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .code(404)
      .send(
        buildErrorBody(
          ErrorTypeEnum.INVALID_REQUEST,
          `Unrecognized request URL (${request.method}: ${request.url})`,
          request.id,
          'resource_missing',
        ),
      );
  });
});
