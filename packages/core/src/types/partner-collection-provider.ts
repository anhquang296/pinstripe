import type { Currency } from '@utils/currency';

export interface PartnerCollectionPayload {
  partnerAccountId: string;
  amount: number;
  currency: Currency;
  idempotencyKey: string;
  invoiceId: string;
  invoiceNumber: string | null;
}

export interface PartnerCollectionResult {
  appliedAmount: number;
  reference: string | null;
}

export interface PartnerCollectionProvider {
  offsetTicketSales(payload: PartnerCollectionPayload): Promise<PartnerCollectionResult>;
  debitWallet(payload: PartnerCollectionPayload): Promise<PartnerCollectionResult>;
}
