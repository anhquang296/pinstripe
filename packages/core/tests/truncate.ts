import { NumberSequenceEnum } from '@contracts/invoices.types';
import type { DatabaseClient } from '@database/database.client';
import { sql } from 'drizzle-orm';
import _ from 'lodash';

interface TableNameRow {
  [column: string]: unknown;
  tableName: string;
}

export async function truncateDatabase(database: DatabaseClient): Promise<void> {
  const rows = await database.master.execute<TableNameRow>(sql`
    select table_name as "tableName"
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `);

  const tableNames = _.map([...rows], 'tableName');

  if (_.isEmpty(tableNames)) {
    throw new Error('truncateDatabase() found no tables, the test database is not migrated');
  }

  const targets = _(tableNames)
    .map((tableName) => {
      return `"${tableName}"`;
    })
    .join(', ');

  await database.master.execute(sql.raw(`truncate ${targets} restart identity cascade`));

  const sequenceNames = Object.values(NumberSequenceEnum);

  for (const name of sequenceNames) {
    await database.master.execute(sql`
      insert into number_sequences (name, next_value)
      values (${name}, 1)
      on conflict (name) do update set next_value = 1
    `);
  }
}
