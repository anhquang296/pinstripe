import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type { FastifyBaseLogger } from 'fastify';
import _ from 'lodash';

export type FileStorageConfig = {
  directory: string;
};

export interface StoredObject {
  key: string;
  contentType: string;
  body: Buffer;
}

export class FileStorageObjectNotFoundError extends Error {
  constructor(message = 'The stored object does not exist') {
    super(message);
    this.name = 'FileStorageObjectNotFoundError';
  }
}

export class FileStorageClient {
  private _directory: string;
  private _logger: FastifyBaseLogger;

  constructor(fileStorageConfig: FileStorageConfig, logger: FastifyBaseLogger) {
    const { directory } = fileStorageConfig;

    this._directory = resolve(directory);
    this._logger = logger;
  }

  async createObject(key: string, body: Buffer): Promise<string> {
    const path = this.resolvePath(key);

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);

    this._logger.debug({ key }, '[FileStorageClient] createObject() success');

    return key;
  }

  async getObject(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolvePath(key));
    } catch (error) {
      this._logger.error({ error, key }, '[FileStorageClient] getObject() error');

      throw new FileStorageObjectNotFoundError(`No stored object for key ${key}`);
    }
  }

  private resolvePath(key: string): string {
    const path = resolve(join(this._directory, key));

    if (_.startsWith(path, this._directory)) {
      return path;
    }

    throw new FileStorageObjectNotFoundError(`Storage key ${key} escapes the storage directory`);
  }
}
