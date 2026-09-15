const UNIQUE_VIOLATION_CODE = '23505';
const FOREIGN_KEY_VIOLATION_CODE = '23503';

function readDriverCode(error: unknown): string | undefined {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return readDriverCode(error) === UNIQUE_VIOLATION_CODE;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return readDriverCode(error) === FOREIGN_KEY_VIOLATION_CODE;
}
