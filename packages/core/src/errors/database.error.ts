import { DrizzleQueryError } from 'drizzle-orm/errors';

const UNIQUE_VIOLATION_CODE = '23505';

function readDriverError(error: unknown): unknown {
  if (error instanceof DrizzleQueryError) {
    return error.cause;
  }

  return error;
}

function readDriverCode(error: unknown): string | undefined {
  const driverError = readDriverError(error);

  if (
    driverError instanceof Error &&
    'code' in driverError &&
    typeof driverError.code === 'string'
  ) {
    return driverError.code;
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return readDriverCode(error) === UNIQUE_VIOLATION_CODE;
}

export function isUniqueViolationOf(error: unknown, constraintName: string): boolean {
  const driverError = readDriverError(error);

  if (
    isUniqueViolation(error) &&
    driverError instanceof Error &&
    'constraint_name' in driverError
  ) {
    return driverError.constraint_name === constraintName;
  }

  return false;
}
