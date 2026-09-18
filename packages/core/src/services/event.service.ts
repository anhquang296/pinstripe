import { PINSTRIPE_API_VERSION } from '@constants/api-version';
import type { DomainEventType, EventResponse, FindEventsQuery } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

interface MaterializeEventPayload {
  id: string;
  type: DomainEventType;
  data: Record<string, unknown>;
  occurredAt: string;
}

export class EventService {
  constructor(private readonly fastify: FastifyInstance) {}

  async recordEvent(payload: MaterializeEventPayload): Promise<void> {
    await this.fastify.eventRepository.createEvent({
      id: payload.id,
      type: payload.type,
      apiVersion: PINSTRIPE_API_VERSION,
      data: { object: payload.data },
      requestId: null,
      createdAt: payload.occurredAt,
    });
  }

  async getEvent(id: string): Promise<EventResponse> {
    const event = await this.fastify.eventRepository.findEvent(id);

    if (event) {
      return event;
    }

    throw new NotFoundError(`No such event: ${id}`);
  }

  async findEvents(query: FindEventsQuery): Promise<ListResponse<EventResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.eventRepository.findEvents(
      { type: query.type, beforeAt, afterAt },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      url: '/v1/events',
      hasMore,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const event = await this.fastify.eventRepository.findEvent(id);

      if (event) {
        return { createdAt: event.createdAt, id: event.id };
      }

      throw new NotFoundError(`No such event: ${id}`);
    }

    return undefined;
  }
}
