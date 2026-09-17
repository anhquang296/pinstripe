export function toNumber(value: string): number {
  return value === '' ? 0 : Number(value);
}
