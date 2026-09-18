import { FileStorageClient } from '@clients/file-storage.client';
import fp from 'fastify-plugin';

export const fileStoragePlugin = fp(async (fastify) => {
  const { FILE_STORAGE_DIRECTORY } = fastify.config;

  fastify.decorate(
    'fileStorage',
    new FileStorageClient({ directory: FILE_STORAGE_DIRECTORY }, fastify.log),
  );
});
