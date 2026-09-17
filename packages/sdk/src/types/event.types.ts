import type { DomainEventType } from '@type/contracts.types';

export interface PinstripeEvent<T = unknown> {
  id: string;
  object: 'event';
  type: DomainEventType;
  createdAt: string;
  data: { object: T };
}
