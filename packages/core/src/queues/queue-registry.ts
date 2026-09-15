import { UnknownQueueError } from '@errors/app.error';
import type { QueueName } from '@queues/queue-name';
import { QueueNameEnum } from '@queues/queue-name';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import _ from 'lodash';

const DEFAULT_JOB_ATTEMPTS = 5;
const DEFAULT_BACKOFF_DELAY_MS = 2000;
const COMPLETED_JOB_RETENTION = 1000;
const FAILED_JOB_RETENTION = 5000;

export class QueueRegistry {
  private readonly queues = new Map<QueueName, Queue>();

  constructor(
    private readonly connection: Redis,
    private readonly prefix: string,
  ) {
    for (const name of Object.values(QueueNameEnum)) {
      this.queues.set(
        name,
        new Queue(name, {
          connection: this.connection,
          prefix: this.prefix,
          defaultJobOptions: {
            attempts: DEFAULT_JOB_ATTEMPTS,
            backoff: { type: 'exponential', delay: DEFAULT_BACKOFF_DELAY_MS },
            removeOnComplete: COMPLETED_JOB_RETENTION,
            removeOnFail: FAILED_JOB_RETENTION,
          },
        }),
      );
    }
  }

  resolve(name: QueueName): Queue {
    const queue = this.queues.get(name);

    if (queue) {
      return queue;
    }

    throw new UnknownQueueError(`QueueRegistry resolve() unknown queue ${name}`);
  }

  async close(): Promise<void> {
    await Promise.all(
      _.map([...this.queues.values()], (queue) => {
        return queue.close();
      }),
    );
  }
}
