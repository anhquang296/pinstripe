import { createHash, randomBytes } from 'node:crypto';

import type {
  ApiKeyResponse,
  ApiKeyScope,
  ApiKeyType,
  CreateApiKeyPayload,
  FindApiKeysQuery,
  RequestAuth,
} from '@contracts/api-keys.types';
import { ApiKeyTypeEnum } from '@contracts/api-keys.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { ApiKey } from '@database/schemas';
import { NotFoundError, UnauthorizedError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const TOKEN_BYTE_LENGTH = 24;
const TOKEN_PREFIX_LENGTH = 12;

const TYPE_PREFIXES: Record<ApiKeyType, string> = {
  [ApiKeyTypeEnum.SECRET]: 'sk',
  [ApiKeyTypeEnum.RESTRICTED]: 'rk',
  [ApiKeyTypeEnum.PUBLISHABLE]: 'pk',
};

export interface BootstrapApiKey {
  name: string;
  token: string;
  scopes: readonly ApiKeyScope[];
}

export class ApiKeyService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createApiKey(payload: CreateApiKeyPayload): Promise<ApiKeyResponse> {
    const token = ApiKeyService.buildToken(payload.type, payload.livemode);
    const now = this.fastify.clock.now();
    const createdApiKey = await this.fastify.apiKeyRepository.createApiKey({
      id: generateGid(ObjectPrefixEnum.API_KEY),
      name: payload.name,
      type: payload.type,
      scopes: [...payload.scopes],
      livemode: payload.livemode,
      tokenPrefix: token.slice(0, TOKEN_PREFIX_LENGTH),
      tokenHash: ApiKeyService.hashToken(token),
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    if (createdApiKey) {
      return ApiKeyService.buildApiKey(createdApiKey, token);
    }

    throw new NotFoundError('Api key could not be created');
  }

  async findApiKeys(query: FindApiKeysQuery): Promise<ListResponse<ApiKeyResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.apiKeyRepository.findApiKeys({ beforeAt, afterAt }, limit + 1);
    const hasMore = rows.length > limit;

    return {
      object: 'list',
      url: '/api/v1/admin/api_keys',
      hasMore,
      data: _(rows)
        .take(limit)
        .map((apiKey) => {
          return ApiKeyService.buildApiKey(apiKey, null);
        })
        .value(),
    };
  }

  async revokeApiKey(id: string): Promise<ApiKeyResponse> {
    const apiKey = await this.getApiKeyEntity(id);
    const now = this.fastify.clock.now();
    const revokedApiKey = await this.fastify.apiKeyRepository.updateApiKey(apiKey.id, {
      revokedAt: apiKey.revokedAt ?? now,
      updatedAt: now,
    });

    if (revokedApiKey) {
      return ApiKeyService.buildApiKey(revokedApiKey, null);
    }

    throw new NotFoundError(`No such api key: ${id}`);
  }

  async authenticateApiKey(token: string): Promise<RequestAuth> {
    const [apiKey] = await this.fastify.apiKeyRepository.findApiKeys(
      { tokenHash: ApiKeyService.hashToken(token) },
      1,
    );

    if (apiKey && !apiKey.revokedAt) {
      await this.fastify.apiKeyRepository.updateApiKey(apiKey.id, {
        lastUsedAt: this.fastify.clock.now(),
      });

      return {
        apiKeyId: apiKey.id,
        type: apiKey.type,
        scopes: apiKey.scopes,
        livemode: apiKey.livemode,
      };
    }

    throw new UnauthorizedError('Invalid API key provided');
  }

  async ensureBootstrapApiKeys(bootstrapKeys: readonly BootstrapApiKey[]): Promise<number> {
    const now = this.fastify.clock.now();

    let createdCount = 0;

    for (const bootstrapKey of bootstrapKeys) {
      const createdApiKey = await this.fastify.apiKeyRepository.createApiKey({
        id: generateGid(ObjectPrefixEnum.API_KEY),
        name: bootstrapKey.name,
        type: ApiKeyTypeEnum.SECRET,
        scopes: [...bootstrapKey.scopes],
        livemode: true,
        tokenPrefix: bootstrapKey.token.slice(0, TOKEN_PREFIX_LENGTH),
        tokenHash: ApiKeyService.hashToken(bootstrapKey.token),
        lastUsedAt: null,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      if (createdApiKey) {
        createdCount += 1;
      }
    }

    this.fastify.log.info({ createdCount }, '[ApiKeyService] ensureBootstrapApiKeys() completed');

    return createdCount;
  }

  private async getApiKeyEntity(id: string): Promise<ApiKey> {
    const apiKey = await this.fastify.apiKeyRepository.findApiKey(id);

    if (apiKey) {
      return apiKey;
    }

    throw new NotFoundError(`No such api key: ${id}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (!id) {
      return undefined;
    }

    const apiKey = await this.getApiKeyEntity(id);

    return { createdAt: apiKey.createdAt, id: apiKey.id };
  }

  static hasScope(auth: RequestAuth, scope: ApiKeyScope): boolean {
    return _.includes(auth.scopes, scope);
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private static buildToken(type: ApiKeyType, livemode: boolean): string {
    const mode = livemode ? 'live' : 'test';

    return `${TYPE_PREFIXES[type]}_${mode}_${randomBytes(TOKEN_BYTE_LENGTH).toString('hex')}`;
  }

  private static buildApiKey(apiKey: ApiKey, token: string | null): ApiKeyResponse {
    return {
      object: 'api_key',
      id: apiKey.id,
      name: apiKey.name,
      type: apiKey.type,
      scopes: apiKey.scopes,
      livemode: apiKey.livemode,
      tokenPrefix: apiKey.tokenPrefix,
      token,
      lastUsedAt: apiKey.lastUsedAt ? apiKey.lastUsedAt.toISOString() : null,
      revokedAt: apiKey.revokedAt ? apiKey.revokedAt.toISOString() : null,
      createdAt: apiKey.createdAt.toISOString(),
    };
  }
}
