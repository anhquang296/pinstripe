import { PINSTRIPE_API_VERSION } from '@constants/api-version';
import type { DomainEventType, EventResponse, FindEventsQuery } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { Event } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

interface MaterializeEventPayload {
  id: string;
  livemode: boolean;
  type: DomainEventType;
  data: Record<string, unknown>;
  occurredAt: Date;
}

export class EventService {
  constructor(private readonly fastify: FastifyInstance) {}

  async recordEvent(payload: MaterializeEventPayload): Promise<void> {
    await this.fastify.eventRepository.createEvent({
      id: payload.id,
      livemode: payload.livemode,
      type: payload.type,
      apiVersion: PINSTRIPE_API_VERSION,
      data: { object: payload.data },
      requestId: null,
      createdAt: payload.occurredAt,
    });
  }

  async getEvent(id: string, livemode: boolean): Promise<EventResponse> {
    const event = await this.fastify.eventRepository.findEvent(id);

    if (event && event.livemode === livemode) {
      return EventService.buildEvent(event);
    }

    throw new NotFoundError(`No such event: ${id}`);
  }

  async findEvents(
    query: FindEventsQuery,
    livemode: boolean,
  ): Promise<ListResponse<EventResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.eventRepository.findEvents(
      { livemode, type: query.type, beforeAt, afterAt },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      object: 'list',
      url: '/v1/events',
      hasMore,
      data: _(rows).take(limit).map(EventService.buildEvent).value(),
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

  private static buildEvent(entity: Event): EventResponse {
    return {
      object: 'event',
      id: entity.id,
      livemode: entity.livemode,
      type: entity.type,
      apiVersion: entity.apiVersion,
      data: entity.data,
      requestId: entity.requestId,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
