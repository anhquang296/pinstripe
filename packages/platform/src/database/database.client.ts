import type { Logger } from '@type/logger';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import postgres from 'postgres';

export type DatabaseConfig = {
  url: string;
  poolMax: number;
};

export type Database = PostgresJsDatabase;
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export class DatabaseClient {
  private _master: Database;
  private _sql: Sql;
  private _logger: Logger;

  constructor(databaseConfig: DatabaseConfig, logger: Logger) {
    const { url, poolMax } = databaseConfig;

    this._sql = postgres(url, { max: poolMax, onnotice: () => {} });
    this._master = drizzle(this._sql);
    this._logger = logger;
  }

  get master(): Database {
    return this._master;
  }

  async connect(): Promise<void> {
    await this._master.execute(sql`select 1`);

    this._logger.info('[DatabaseClient] connect() database connection established');
  }

  async close(): Promise<void> {
    await this._sql.end({ timeout: 5 });

    this._logger.info('[DatabaseClient] close() database connection closed');
  }
}
