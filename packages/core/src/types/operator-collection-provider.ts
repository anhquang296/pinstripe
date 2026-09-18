import type { Currency } from '@utils/currency';

export interface OperatorCollectionPayload {
  operatorId: string;
  amount: number;
  currency: Currency;
  idempotencyKey: string;
  invoiceId: string;
  invoiceNumber: string | null;
}

export interface OperatorCollectionResult {
  appliedAmount: number;
  reference: string | null;
}

export interface OperatorCollectionProvider {
  offsetTicketSales(payload: OperatorCollectionPayload): Promise<OperatorCollectionResult>;
  debitWallet(payload: OperatorCollectionPayload): Promise<OperatorCollectionResult>;
}
