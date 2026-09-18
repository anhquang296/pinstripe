export function toNullableNumber(value: string): number | null {
  if (value === '') {
    return null;
  }

  return Number(value);
}
