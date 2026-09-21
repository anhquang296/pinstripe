import { DatabaseSchemaEnum } from '@vxrerp/platform/types';
import { pgSchema } from 'drizzle-orm/pg-core';

export const crmPgSchema = pgSchema(DatabaseSchemaEnum.CRM);
