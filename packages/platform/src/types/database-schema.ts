export enum DatabaseSchemaEnum {
  PLATFORM = 'platform',
  BILLING = 'billing',
}

export type DatabaseSchema = `${DatabaseSchemaEnum}`;
