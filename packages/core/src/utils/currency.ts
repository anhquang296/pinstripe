export enum CurrencyEnum {
  VND = 'vnd',
  USD = 'usd',
  EUR = 'eur',
  GBP = 'gbp',
  JPY = 'jpy',
  SGD = 'sgd',
  AUD = 'aud',
  THB = 'thb',
  KRW = 'krw',
}
export type Currency = `${CurrencyEnum}`;

const CURRENCY_EXPONENTS: Record<Currency, number> = {
  [CurrencyEnum.VND]: 0,
  [CurrencyEnum.USD]: 2,
  [CurrencyEnum.EUR]: 2,
  [CurrencyEnum.GBP]: 2,
  [CurrencyEnum.JPY]: 0,
  [CurrencyEnum.SGD]: 2,
  [CurrencyEnum.AUD]: 2,
  [CurrencyEnum.THB]: 2,
  [CurrencyEnum.KRW]: 0,
};

export function getCurrencyExponent(currency: Currency): number {
  return CURRENCY_EXPONENTS[currency];
}

export function isCurrency(value: string): value is Currency {
  return value in CURRENCY_EXPONENTS;
}
