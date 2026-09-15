import * as schemas from '@database/schemas';
import type { Logger } from '@type/logger';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import postgres from 'postgres';

export interface DatabaseClientConfig {
  url: string;
  poolMax: number;
}

export type Database = PostgresJsDatabase<typeof schemas>;
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export class DatabaseClient {
  readonly master: Database;

  private readonly sql: Sql;

  constructor(
    config: DatabaseClientConfig,
    private readonly logger: Logger,
  ) {
    this.sql = postgres(config.url, { max: config.poolMax, onnotice: () => {} });
    this.master = drizzle(this.sql, { schema: schemas });
  }

  async connect(): Promise<void> {
    await this.master.execute(sql`select 1`);

    this.logger.info('[DatabaseClient] connect() database connection established');
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });

    this.logger.info('[DatabaseClient] close() database connection closed');
  }
}
