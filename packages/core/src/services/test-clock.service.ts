import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  AdvanceTestClockPayload,
  CreateTestClockPayload,
  GetTestClocksQuery,
  TestClockResponse,
} from '@contracts/test-clocks.types';
import { TestClockStatusEnum } from '@contracts/test-clocks.types';
import type { TestClock } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class TestClockService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createTestClock(payload: CreateTestClockPayload): Promise<TestClockResponse> {
    const now = this.fastify.clock.now();
    const createdTestClock = await this.fastify.testClockRepository.createTestClock({
      id: generateId(ObjectPrefixEnum.TEST_CLOCK),
      name: payload.name,
      frozenTime: new Date(payload.frozenTime),
      status: TestClockStatusEnum.READY,
      createdAt: now,
      updatedAt: now,
    });

    if (!createdTestClock) {
      throw new NotFoundError('Test clock could not be created');
    }

    return TestClockService.buildTestClock(createdTestClock);
  }

  async getTestClock(id: string): Promise<TestClockResponse> {
    const clock = await this.fastify.testClockRepository.findTestClock(id);

    if (clock) {
      return TestClockService.buildTestClock(clock);
    }

    throw new NotFoundError(`No such test clock: ${id}`);
  }

  async findTestClocks(query: GetTestClocksQuery): Promise<ListResponse<TestClockResponse>> {
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
      object: 'list',
      url: '/v1/test_helpers/test_clocks',
      hasMore,
      data: _(rows).take(limit).map(TestClockService.buildTestClock).value(),
    };
  }

  async advanceTestClock(id: string, payload: AdvanceTestClockPayload): Promise<TestClockResponse> {
    const clock = await this.fastify.testClockRepository.findTestClock(id);

    if (!clock) {
      throw new NotFoundError(`No such test clock: ${id}`);
    }

    if (clock.status === TestClockStatusEnum.ADVANCING) {
      throw new ConflictError(`Test clock ${id} is already advancing`);
    }

    const target = new Date(payload.frozenTime);

    if (target.getTime() <= clock.frozenTime.getTime()) {
      throw new BadRequestError(
        `A test clock only moves forward: ${target.toISOString()} is not after ${clock.frozenTime.toISOString()}`,
        { param: 'frozenTime' },
      );
    }

    await this.fastify.testClockRepository.updateTestClock(id, {
      status: TestClockStatusEnum.ADVANCING,
      updatedAt: this.fastify.clock.now(),
    });

    try {
      await this.fastify.testClockRepository.updateTestClock(id, { frozenTime: target });
      await this.fastify.subscriptionService.advanceSubscriptions(id, target);
    } catch (error) {
      await this.fastify.testClockRepository.updateTestClock(id, {
        status: TestClockStatusEnum.READY,
      });

      throw error;
    }

    const advanced = await this.fastify.database.master.transaction(async (tx) => {
      const next = await this.fastify.testClockRepository.updateTestClock(
        id,
        { status: TestClockStatusEnum.READY, updatedAt: this.fastify.clock.now() },
        tx,
      );

      if (!next) {
        throw new NotFoundError(`No such test clock: ${id}`);
      }

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
    });

    return TestClockService.buildTestClock(advanced);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (!id) {
      return undefined;
    }

    const clock = await this.fastify.testClockRepository.findTestClock(id);

    if (!clock) {
      throw new NotFoundError(`No such test clock: ${id}`);
    }

    return { createdAt: clock.createdAt, id: clock.id };
  }

  private static buildTestClock(entity: TestClock): TestClockResponse {
    return {
      object: 'test_clock',
      id: entity.id,
      name: entity.name,
      frozenTime: entity.frozenTime.toISOString(),
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
