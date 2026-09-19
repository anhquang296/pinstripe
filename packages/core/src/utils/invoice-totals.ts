import type { PortalInvoiceTotalsResponse } from '@contracts/portal.types';
import type { Currency } from '@utils/currency';
import _ from 'lodash';

export interface OpenInvoiceBalance {
  currency: Currency;
  amountRemaining: number;
  dueAt: string | null;
}

export type CurrencyInvoiceTotals = PortalInvoiceTotalsResponse['totals'][number];

function buildCurrencyTotals(
  currency: string,
  balances: readonly OpenInvoiceBalance[],
  now: Date,
  dueSoonBeforeAt: Date,
): CurrencyInvoiceTotals {
  const overdueBalances = _.filter(balances, (balance) => {
    return balance.dueAt !== null && new Date(balance.dueAt) < now;
  });
  const upcomingDueAts = _(balances)
    .map('dueAt')
    .compact()
    .map((dueAt) => {
      return new Date(dueAt);
    })
    .reject((dueAt) => {
      return dueAt < now;
    })
    .sortBy((dueAt) => {
      return dueAt.getTime();
    })
    .value();
  const dueSoonBalances = _.filter(balances, (balance) => {
    if (balance.dueAt === null) {
      return false;
    }

    const dueAt = new Date(balance.dueAt);

    return dueAt >= now && dueAt < dueSoonBeforeAt;
  });
  const nextDueDate = _.first(upcomingDueAts);
  const nextDueAt = nextDueDate ? nextDueDate.toISOString() : null;

  return {
    currency,
    openAmount: _.sumBy(balances, 'amountRemaining'),
    openCount: _.size(balances),
    overdueAmount: _.sumBy(overdueBalances, 'amountRemaining'),
    overdueCount: _.size(overdueBalances),
    dueSoonAmount: _.sumBy(dueSoonBalances, 'amountRemaining'),
    dueSoonCount: _.size(dueSoonBalances),
    nextDueAt,
  };
}

export function buildInvoiceTotals(
  balances: readonly OpenInvoiceBalance[],
  now: Date,
  dueSoonBeforeAt: Date,
): CurrencyInvoiceTotals[] {
  return _(balances)
    .groupBy('currency')
    .map((currencyBalances, currency) => {
      return buildCurrencyTotals(currency, currencyBalances, now, dueSoonBeforeAt);
    })
    .sortBy('currency')
    .value();
}
