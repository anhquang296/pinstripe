import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  AdvanceTestClockPayload,
  CreateTestClockPayload,
  FindTestClocksQuery,
  TestClockResponse,
} from '@contracts/test-clocks.types';
import { TestClockStatusEnum } from '@contracts/test-clocks.types';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export interface TestClockConfig {
  isEnabled: boolean;
}

export class TestClockService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly testClockConfig: TestClockConfig,
  ) {}

  get isEnabled(): boolean {
    return this.testClockConfig.isEnabled;
  }

  async createTestClock(payload: CreateTestClockPayload): Promise<TestClockResponse> {
    const now = this.fastify.clock.now().toISOString();
    const frozenTime = new Date(payload.frozenTime).toISOString();

    const createdTestClock = await this.fastify.testClockRepository.createTestClock({
      id: generateGid(ObjectPrefixEnum.TEST_CLOCK),
      name: payload.name,
      frozenTime,
      status: TestClockStatusEnum.READY,
      createdAt: now,
      updatedAt: now,
    });

    if (createdTestClock) {
      return createdTestClock;
    }

    throw new NotFoundError('Test clock could not be created');
  }

  async getTestClock(id: string): Promise<TestClockResponse> {
    return this.fastify.testClockRepository.getTestClock(id);
  }

  async findTestClocks(query: FindTestClocksQuery): Promise<ListResponse<TestClockResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const rows = await this.fastify.testClockRepository.findTestClocks(
      {
        beforeAt: await this.resolveCursor(query.startingAfter),
        afterAt: await this.resolveCursor(query.endingBefore),
      },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      url: '/v1/test_helpers/test_clocks',
      hasMore,
      data: _.take(rows, limit),
    };
  }

  async advanceTestClock(id: string, payload: AdvanceTestClockPayload): Promise<TestClockResponse> {
    const clock = await this.fastify.testClockRepository.getTestClock(id);

    if (clock.status === TestClockStatusEnum.ADVANCING) {
      throw new ConflictError(`Test clock ${id} is already advancing`);
    }

    const target = new Date(payload.frozenTime);
    const frozenTime = new Date(clock.frozenTime);

    if (target.getTime() <= frozenTime.getTime()) {
      throw new BadRequestError(
        `A test clock only moves forward: ${target.toISOString()} is not after ${clock.frozenTime}`,
        { param: 'frozenTime' },
      );
    }

    await this.fastify.testClockRepository.updateTestClock(id, {
      status: TestClockStatusEnum.ADVANCING,
      updatedAt: this.fastify.clock.now().toISOString(),
    });

    try {
      await this.fastify.testClockRepository.updateTestClock(id, {
        frozenTime: target.toISOString(),
      });
      await this.fastify.subscriptionService.runSubscriptionLifecycle({ testClockId: id }, target);
    } catch (error) {
      await this.fastify.testClockRepository.updateTestClock(id, {
        status: TestClockStatusEnum.READY,
      });

      throw error;
    }

    const advanced = await this.fastify.database.master.transaction(async (tx) => {
      const next = await this.fastify.testClockRepository.updateTestClock(
        id,
        { status: TestClockStatusEnum.READY, updatedAt: this.fastify.clock.now().toISOString() },
        tx,
      );

      if (next) {
        await this.fastify.outboxService.recordEvents(
          [
            {
              aggregateType: AggregateTypeEnum.TEST_CLOCK,
              aggregateId: id,
              eventType: DomainEventTypeEnum.TEST_CLOCK_ADVANCED,
              payload: { id, frozenTime: target.toISOString() },
            },
          ],
          tx,
        );

        return next;
      }

      throw new NotFoundError(`No such test clock: ${id}`);
    });

    return advanced;
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const testClock = await this.fastify.testClockRepository.getTestClock(id);

      return { createdAt: testClock.createdAt, id: testClock.id };
    }

    return undefined;
  }
}
