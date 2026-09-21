import { VXRERP_API_VERSION } from '@constants/api-version';
import type { DomainEventType, EventResponse, FindEventsQuery } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
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
      apiVersion: VXRERP_API_VERSION,
      data: { object: payload.data },
      requestId: null,
      createdAt: payload.occurredAt,
    });
  }

  async getEvent(id: string): Promise<EventResponse> {
    return this.fastify.eventRepository.getEvent(id);
  }

  async findEvents(query: FindEventsQuery): Promise<ListResponse<EventResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

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
      const event = await this.fastify.eventRepository.getEvent(id);

      return { createdAt: event.createdAt, id: event.id };
    }

    return undefined;
  }
}
