import type { FastifyReply } from 'fastify';

export interface ListResponse<T> {
  object: 'list';
  url: string;
  hasMore: boolean;
  data: T[];
}

export const ApiResponse = {
  success<T>(reply: FastifyReply, payload: T): FastifyReply {
    return reply.code(200).send(payload);
  },

  created<T>(reply: FastifyReply, payload: T): FastifyReply {
    return reply.code(201).send(payload);
  },

  list<T>(reply: FastifyReply, url: string, data: T[], hasMore: boolean): FastifyReply {
    const payload: ListResponse<T> = { object: 'list', url, hasMore, data };

    return reply.code(200).send(payload);
  },

  noContent(reply: FastifyReply): FastifyReply {
    return reply.code(204).send();
  },
};
