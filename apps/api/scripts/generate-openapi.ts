import { writeFile } from 'node:fs/promises';

import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { swaggerPlugin } from '@plugins/swagger.plugin';
import { v1Routes } from '@routes/v1/v1.routes';
import { TestClockService } from '@vxrerp/billing/services';
import Fastify from 'fastify';

const OPENAPI_FILE_URL = new URL('../openapi.json', import.meta.url);

async function run(): Promise<void> {
  const fastify = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();

  fastify.decorate('testClockService', new TestClockService(fastify, { isEnabled: true }));

  await fastify.register(swaggerPlugin);
  await fastify.register(v1Routes, { prefix: '/v1' });
  await fastify.ready();

  const document = fastify.swagger();

  await writeFile(OPENAPI_FILE_URL, `${JSON.stringify(document, null, 2)}\n`);
  await fastify.close();
}

run().catch((error: unknown) => {
  process.stderr.write(`run() failed to generate openapi: ${String(error)}\n`);
  process.exit(1);
});
