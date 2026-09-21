import { DatabaseSchemaEnum } from '@vxrerp/platform/types';
import { pgSchema } from 'drizzle-orm/pg-core';

export const billingPgSchema = pgSchema(DatabaseSchemaEnum.BILLING);
