export enum DatabaseSchemaEnum {
  PLATFORM = 'platform',
  BILLING = 'billing',
  CRM = 'crm',
}

export type DatabaseSchema = `${DatabaseSchemaEnum}`;
