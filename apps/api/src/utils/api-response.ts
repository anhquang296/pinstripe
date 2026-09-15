import type { FastifyReply } from 'fastify';

export const ApiResponse = {
  success<T>(reply: FastifyReply, payload: T): FastifyReply {
    return reply.code(200).send(payload);
  },

  created<T>(reply: FastifyReply, payload: T): FastifyReply {
    return reply.code(201).send(payload);
  },

  accepted<T>(reply: FastifyReply, payload: T): FastifyReply {
    return reply.code(202).send(payload);
  },
};
