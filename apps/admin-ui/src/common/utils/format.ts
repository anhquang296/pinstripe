import { toUpper } from 'lodash-es';

const LOCALE = 'vi-VN';
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function formatCurrency(minorAmount: number, currency: string): string {
  const formatter = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: toUpper(currency),
  });
  const { maximumFractionDigits = 0 } = formatter.resolvedOptions();

  return formatter.format(minorAmount / 10 ** maximumFractionDigits);
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
