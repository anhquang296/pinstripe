import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { IdempotencyKey } from '@database/schemas';
import { IdempotencyStatusEnum } from '@database/schemas';
import { IdempotencyConflictError, IdempotencyInProgressError } from '@errors/idempotency.error';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export interface BeginIdempotentRequestPayload {
  scope: string;
  key: string;
  route: string;
  body: unknown;
}

export interface ReplayedResponse {
  statusCode: number;
  body: unknown;
}

export interface IdempotentRequestTicket {
  id: string;
  replay: ReplayedResponse | null;
}

export interface IdempotencyServiceConfig {
  retentionHours: number;
}

export class IdempotencyService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly config: IdempotencyServiceConfig,
  ) {}

  async beginRequest(payload: BeginIdempotentRequestPayload): Promise<IdempotentRequestTicket> {
    const requestHash = IdempotencyService.buildRequestHash(payload.body);
    const now = this.fastify.clock.now();
    const created = await this.fastify.idempotencyKeyRepository.createIdempotencyKey({
      id: generateId(ObjectPrefixEnum.REQUEST),
      key: payload.key,
      scope: payload.scope,
      route: payload.route,
      requestHash,
      status: IdempotencyStatusEnum.IN_PROGRESS,
      lockedAt: now,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + this.config.retentionHours * MILLISECONDS_PER_HOUR),
    });

    if (created) {
      return { id: created.id, replay: null };
    }

    const existing = await this.fastify.idempotencyKeyRepository.findIdempotencyKey(
      payload.scope,
      payload.key,
      payload.route,
    );

    if (!existing) {
      throw new IdempotencyInProgressError(
        `Idempotency key ${payload.key} is being processed concurrently`,
      );
    }

    return { id: existing.id, replay: this.resolveReplay(existing, requestHash) };
  }

  async completeRequest(id: string, statusCode: number, body: unknown): Promise<void> {
    await this.fastify.idempotencyKeyRepository.completeIdempotencyKey(
      id,
      IdempotencyStatusEnum.SUCCEEDED,
      statusCode,
      body,
    );
  }

  async releaseRequest(id: string): Promise<void> {
    await this.fastify.idempotencyKeyRepository.releaseIdempotencyKey(id);
  }

  async purgeExpiredRequests(): Promise<void> {
    await this.fastify.idempotencyKeyRepository.deleteExpiredIdempotencyKeys(
      this.fastify.clock.now(),
    );
  }

  private resolveReplay(existing: IdempotencyKey, requestHash: string): ReplayedResponse | null {
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyConflictError(
        `Idempotency key ${existing.key} was already used with a different request body`,
      );
    }

    if (existing.status === IdempotencyStatusEnum.IN_PROGRESS) {
      throw new IdempotencyInProgressError(
        `Idempotency key ${existing.key} is being processed concurrently`,
      );
    }

    if (existing.status === IdempotencyStatusEnum.SUCCEEDED && existing.responseStatusCode) {
      return { statusCode: existing.responseStatusCode, body: existing.responseBody };
    }

    return null;
  }

  private static buildRequestHash(body: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(body ?? null))
      .digest('hex');
  }
}
