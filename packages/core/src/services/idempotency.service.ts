import { createHash } from 'node:crypto';

import { IdempotencyStatusEnum } from '@contracts/idempotency.types';
import type { IdempotencyKey } from '@database/schemas';
import { IdempotencyConflictError, IdempotencyInProgressError } from '@errors/idempotency.error';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';

export interface BeginIdempotentRequestPayload {
  scope: string;
  key: string;
  route: string;
  params: unknown;
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
    const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

    const requestHash = IdempotencyService.buildRequestHash(payload);

    const now = this.fastify.clock.now();
    const lockedAt = now.toISOString();
    const expiresAt = new Date(
      now.getTime() + this.config.retentionHours * MILLISECONDS_PER_HOUR,
    ).toISOString();

    const createdIdempotencyKey = await this.fastify.idempotencyKeyRepository.createIdempotencyKey({
      id: generateGid(ObjectPrefixEnum.REQUEST),
      key: payload.key,
      scope: payload.scope,
      route: payload.route,
      requestHash,
      status: IdempotencyStatusEnum.IN_PROGRESS,
      lockedAt,
      createdAt: lockedAt,
      updatedAt: lockedAt,
      expiresAt,
    });

    if (createdIdempotencyKey) {
      return { id: createdIdempotencyKey.id, replay: null };
    }

    const existingIdempotencyKey = await this.fastify.idempotencyKeyRepository.findIdempotencyKey(
      payload.scope,
      payload.key,
      payload.route,
    );

    if (existingIdempotencyKey) {
      return {
        id: existingIdempotencyKey.id,
        replay: this.resolveReplay(existingIdempotencyKey, requestHash),
      };
    }

    throw new IdempotencyInProgressError(
      `Idempotency key ${payload.key} is being processed concurrently`,
    );
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

  async deleteExpiredRequests(): Promise<void> {
    await this.fastify.idempotencyKeyRepository.deleteExpiredIdempotencyKeys(
      this.fastify.clock.now().toISOString(),
    );
  }

  private resolveReplay(
    existingIdempotencyKey: IdempotencyKey,
    requestHash: string,
  ): ReplayedResponse | null {
    if (existingIdempotencyKey.requestHash !== requestHash) {
      throw new IdempotencyConflictError(
        `Idempotency key ${existingIdempotencyKey.key} was already used with different request parameters`,
      );
    }

    if (existingIdempotencyKey.status === IdempotencyStatusEnum.IN_PROGRESS) {
      throw new IdempotencyInProgressError(
        `Idempotency key ${existingIdempotencyKey.key} is being processed concurrently`,
      );
    }

    if (
      existingIdempotencyKey.status === IdempotencyStatusEnum.SUCCEEDED &&
      existingIdempotencyKey.responseStatusCode
    ) {
      return {
        statusCode: existingIdempotencyKey.responseStatusCode,
        body: existingIdempotencyKey.responseBody,
      };
    }

    return null;
  }

  private static buildRequestHash(payload: BeginIdempotentRequestPayload): string {
    const identity = { params: payload.params ?? null, body: payload.body ?? null };

    return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  }
}
