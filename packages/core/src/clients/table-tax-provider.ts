import type { TaxBehavior } from '@contracts/prices.types';
import { TaxBehaviorEnum } from '@contracts/prices.types';
import { TaxExemptEnum } from '@contracts/taxes.types';
import type { TaxRate } from '@database/schemas';
import type { TaxRateRepository } from '@repositories/tax-rate.repository';
import type { Logger } from '@type/logger';
import type {
  TaxCalculationDraft,
  TaxCalculationLine,
  TaxCalculationLineAmounts,
  TaxProvider,
} from '@type/tax-provider';
import type { TaxRateSnapshot } from '@utils/tax';
import { buildLineTaxAmounts } from '@utils/tax';
import _ from 'lodash';

const JURISDICTION_RATE_LIMIT = 10;

export type TableTaxConfig = {
  taxRateRepository: TaxRateRepository;
};

export class TableTaxProvider implements TaxProvider {
  private _taxRateRepository: TaxRateRepository;
  private _logger: Logger;

  constructor(tableTaxConfig: TableTaxConfig, logger: Logger) {
    const { taxRateRepository } = tableTaxConfig;

    this._taxRateRepository = taxRateRepository;
    this._logger = logger;
  }

  async calculate(draft: TaxCalculationDraft): Promise<TaxCalculationLineAmounts[]> {
    if (draft.taxExempt !== TaxExemptEnum.NONE) {
      return [];
    }

    const explicitRateById = await this.resolveExplicitRates(draft);
    const jurisdictionRates = await this.resolveJurisdictionRates(draft);

    return _(draft.lines)
      .map((line) => {
        const rates = TableTaxProvider.resolveLineRates(line, explicitRateById, jurisdictionRates);
        const snapshots = _.map(rates, (rate) => {
          return TableTaxProvider.buildSnapshot(rate, line.taxBehavior);
        });
        const taxAmounts = buildLineTaxAmounts(line.taxableAmount, snapshots, draft.currency);

        return { reference: line.reference, taxAmounts };
      })
      .reject(({ taxAmounts }) => {
        return _.isEmpty(taxAmounts);
      })
      .value();
  }

  private async resolveExplicitRates(draft: TaxCalculationDraft): Promise<Record<string, TaxRate>> {
    const rateIds = _(draft.lines).flatMap('taxRateIds').uniq().value();

    if (_.isEmpty(rateIds)) {
      return {};
    }

    const rates = await this._taxRateRepository.findTaxRates(
      { ids: rateIds, active: true },
      rateIds.length,
    );

    const missingIds = _.difference(rateIds, _.map(rates, 'id'));

    if (!_.isEmpty(missingIds)) {
      this._logger.warn(
        { missingIds },
        '[TableTaxProvider] resolveExplicitRates() skipped, no active tax rate',
      );
    }

    return _.keyBy(rates, 'id');
  }

  private async resolveJurisdictionRates(draft: TaxCalculationDraft): Promise<TaxRate[]> {
    const { country } = draft;

    if (!draft.isAutomatic || !country) {
      return [];
    }

    return this._taxRateRepository.findJurisdictionTaxRates(
      country,
      draft.state,
      JURISDICTION_RATE_LIMIT,
    );
  }

  private static resolveLineRates(
    line: TaxCalculationLine,
    explicitRateById: Record<string, TaxRate>,
    jurisdictionRates: readonly TaxRate[],
  ): TaxRate[] {
    const explicitRates = _(line.taxRateIds)
      .uniq()
      .map((taxRateId) => {
        return _.get(explicitRateById, taxRateId, null);
      })
      .compact()
      .value();

    if (_.isEmpty(explicitRates)) {
      return [...jurisdictionRates];
    }

    return explicitRates;
  }

  private static buildSnapshot(rate: TaxRate, taxBehavior: TaxBehavior): TaxRateSnapshot {
    return {
      taxRateId: rate.id,
      percentage: rate.percentage,
      isInclusive: TableTaxProvider.readInclusive(rate, taxBehavior),
      taxType: rate.taxType,
    };
  }

  private static readInclusive(rate: TaxRate, taxBehavior: TaxBehavior): boolean {
    if (taxBehavior === TaxBehaviorEnum.INCLUSIVE) {
      return true;
    }

    if (taxBehavior === TaxBehaviorEnum.EXCLUSIVE) {
      return false;
    }

    return rate.inclusive;
  }
}
