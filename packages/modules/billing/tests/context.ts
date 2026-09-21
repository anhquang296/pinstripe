import { NumberSequenceEnum } from '@contracts/invoices.types';
import { numberSequences } from '@database/schemas/invoices.schema';
import { billingPlugin } from '@plugins/billing.plugin';
import { platformPlugin } from '@vxrerp/platform/plugins';
import { truncateDatabase } from '@vxrerp/platform/testing';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

async function resetNumberSequences(fastify: FastifyInstance): Promise<void> {
  for (const name of Object.values(NumberSequenceEnum)) {
    await fastify.database.master.execute(sql`
      insert into ${numberSequences} (name, next_value)
      values (${name}, 1)
      on conflict (name) do update set next_value = 1
    `);
  }
}

export async function buildTestContext(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  await fastify.register(platformPlugin);
  await fastify.register(billingPlugin);
  await truncateDatabase(fastify.database);
  await resetNumberSequences(fastify);

  return fastify;
}
