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
  type?: ApiKeyType;
}

export class ApiKeyService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createApiKey(payload: CreateApiKeyPayload): Promise<ApiKeyResponse> {
    const token = ApiKeyService.buildToken(payload.type);

    const createdAt = this.fastify.clock.now().toISOString();

    const createdApiKey = await this.fastify.apiKeyRepository.createApiKey({
      id: generateGid(ObjectPrefixEnum.API_KEY),
      name: payload.name,
      type: payload.type,
      scopes: [...payload.scopes],
      tokenPrefix: token.slice(0, TOKEN_PREFIX_LENGTH),
      tokenHash: ApiKeyService.hashToken(token),
      lastUsedAt: null,
      revokedAt: null,
      createdAt: createdAt,
      updatedAt: createdAt,
    });

    if (createdApiKey) {
      return ApiKeyService.buildApiKey(createdApiKey, token);
    }

    throw new NotFoundError('Api key could not be created');
  }

  async findApiKeys(query: FindApiKeysQuery): Promise<ListResponse<ApiKeyResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.apiKeyRepository.findApiKeys({ beforeAt, afterAt }, limit + 1);
    const hasMore = rows.length > limit;

    return {
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
    const apiKey = await this.fastify.apiKeyRepository.getApiKey(id);

    const updatedAt = this.fastify.clock.now().toISOString();
    const { revokedAt: currentRevokedAt } = apiKey;
    const revokedAt = currentRevokedAt === null ? updatedAt : currentRevokedAt;

    const revokedApiKey = await this.fastify.apiKeyRepository.updateApiKey(apiKey.id, {
      revokedAt,
      updatedAt: updatedAt,
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
        lastUsedAt: this.fastify.clock.now().toISOString(),
      });

      return {
        apiKeyId: apiKey.id,
        type: apiKey.type,
        scopes: apiKey.scopes,
      };
    }

    throw new UnauthorizedError('Invalid API key provided');
  }

  async ensureBootstrapApiKeys(bootstrapKeys: readonly BootstrapApiKey[]): Promise<number> {
    const createdAt = this.fastify.clock.now().toISOString();

    let createdCount = 0;

    for (const bootstrapKey of bootstrapKeys) {
      const { type = ApiKeyTypeEnum.SECRET } = bootstrapKey;

      const createdApiKey = await this.fastify.apiKeyRepository.createApiKey({
        id: generateGid(ObjectPrefixEnum.API_KEY),
        name: bootstrapKey.name,
        type,
        scopes: [...bootstrapKey.scopes],
        tokenPrefix: bootstrapKey.token.slice(0, TOKEN_PREFIX_LENGTH),
        tokenHash: ApiKeyService.hashToken(bootstrapKey.token),
        lastUsedAt: null,
        revokedAt: null,
        createdAt: createdAt,
        updatedAt: createdAt,
      });

      if (createdApiKey) {
        createdCount += 1;
      }
    }

    this.fastify.log.info({ createdCount }, '[ApiKeyService] ensureBootstrapApiKeys() completed');

    return createdCount;
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const apiKey = await this.fastify.apiKeyRepository.getApiKey(id);

      return { createdAt: apiKey.createdAt, id: apiKey.id };
    }

    return undefined;
  }

  static hasScope(auth: RequestAuth, scope: ApiKeyScope): boolean {
    return _.includes(auth.scopes, scope);
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private static buildToken(type: ApiKeyType): string {
    return `${TYPE_PREFIXES[type]}_${randomBytes(TOKEN_BYTE_LENGTH).toString('hex')}`;
  }

  private static buildApiKey(apiKey: ApiKey, token: string | null): ApiKeyResponse {
    return {
      id: apiKey.id,
      name: apiKey.name,
      type: apiKey.type,
      scopes: apiKey.scopes,
      tokenPrefix: apiKey.tokenPrefix,
      token,
      lastUsedAt: apiKey.lastUsedAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    };
  }
}
