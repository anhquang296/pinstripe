import { DatabaseSchemaEnum } from '@type/database-schema';
import { pgSchema } from 'drizzle-orm/pg-core';

export const platformPgSchema = pgSchema(DatabaseSchemaEnum.PLATFORM);
