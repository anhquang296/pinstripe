import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createCreditNoteSchema,
  creditNoteSchema,
  getCreditNotesSchema,
  ListResponseSchema,
} from '@pinstripe/core/contracts';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';

export const creditNotesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createCreditNoteSchema, response: { 201: creditNoteSchema } } },
    async (request, reply) => {
      const creditNote = await fastify.creditNoteService.createCreditNote(request.body);

      return ApiResponse.created(reply, creditNote);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: getCreditNotesSchema,
        response: { 200: ListResponseSchema(creditNoteSchema) },
      },
    },
    async (request, reply) => {
      const creditNotes = await fastify.creditNoteService.findCreditNotes(request.query);

      return ApiResponse.success(reply, creditNotes);
    },
  );

  fastify.get(
    '/:creditNoteId',
    {
      schema: {
        params: Type.Object({ creditNoteId: Type.String() }),
        response: { 200: creditNoteSchema },
      },
    },
    async (request, reply) => {
      const creditNote = await fastify.creditNoteService.getCreditNote(request.params.creditNoteId);

      return ApiResponse.success(reply, creditNote);
    },
  );
};
