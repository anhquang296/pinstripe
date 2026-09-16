import { createHash } from 'node:crypto';

import { MILLISECONDS_PER_HOUR } from '@constants/time';
import { IdempotencyStatusEnum } from '@contracts/idempotency.types';
import type { IdempotencyKey } from '@database/schemas';
import { IdempotencyConflictError, IdempotencyInProgressError } from '@errors/idempotency.error';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';

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

    const createdIdempotencyKey = await this.fastify.idempotencyKeyRepository.createIdempotencyKey({
      id: generateGid(ObjectPrefixEnum.REQUEST),
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

    if (createdIdempotencyKey) {
      return { id: createdIdempotencyKey.id, replay: null };
    }

    const existingIdempotencyKey = await this.fastify.idempotencyKeyRepository.findIdempotencyKey(
      payload.scope,
      payload.key,
      payload.route,
    );

    if (!existingIdempotencyKey) {
      throw new IdempotencyInProgressError(
        `Idempotency key ${payload.key} is being processed concurrently`,
      );
    }

    return {
      id: existingIdempotencyKey.id,
      replay: this.resolveReplay(existingIdempotencyKey, requestHash),
    };
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
      this.fastify.clock.now(),
    );
  }

  private resolveReplay(
    existingIdempotencyKey: IdempotencyKey,
    requestHash: string,
  ): ReplayedResponse | null {
    if (existingIdempotencyKey.requestHash !== requestHash) {
      throw new IdempotencyConflictError(
        `Idempotency key ${existingIdempotencyKey.key} was already used with a different request body`,
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

  private static buildRequestHash(body: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(body ?? null))
      .digest('hex');
  }
}
