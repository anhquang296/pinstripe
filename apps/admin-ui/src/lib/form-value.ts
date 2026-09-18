export function toNumber(value: string): number {
  if (value === '') {
    return 0;
  }

  return Number(value);
}
