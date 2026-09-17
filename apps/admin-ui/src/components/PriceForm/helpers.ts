export function toNullableNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}
