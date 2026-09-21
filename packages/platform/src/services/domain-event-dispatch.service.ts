import { ConflictError } from '@errors/app.error';
import type { DomainEventDispatchJob } from '@queues/domain-event.queue';
import type { DomainEventHandler } from '@type/domain-event-handler';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class DomainEventDispatchService {
  private readonly handlers: DomainEventHandler[] = [];

  constructor(private readonly fastify: FastifyInstance) {}

  registerDomainEventHandler(handler: DomainEventHandler): void {
    if (_.some(this.handlers, { name: handler.name })) {
      throw new ConflictError(`Domain event handler ${handler.name} is already registered`);
    }

    this.handlers.push(handler);
  }

  async handleDomainEvent(event: DomainEventDispatchJob): Promise<void> {
    const { eventId, eventType, aggregateType } = event;

    const deliveries = await this.fastify.webhookService.handleDomainEvent(event);

    if (deliveries > 0) {
      this.fastify.log.info(
        { eventId, eventType, deliveries },
        '[DomainEventDispatchService] handleDomainEvent() queued webhook deliveries',
      );
    }

    const matchedHandlers = _.filter(this.handlers, (handler) => {
      return _.includes(handler.aggregateTypes, aggregateType);
    });

    if (_.isEmpty(matchedHandlers)) {
      this.fastify.log.debug(
        { eventId, eventType },
        '[DomainEventDispatchService] handleDomainEvent() no consumer for this event yet',
      );

      return;
    }

    for (const handler of matchedHandlers) {
      await handler.handle(event);

      this.fastify.log.info(
        { eventId, eventType, handler: handler.name },
        '[DomainEventDispatchService] handleDomainEvent() handler completed',
      );
    }
  }
}
