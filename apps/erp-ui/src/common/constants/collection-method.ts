import type { CollectionMethod } from '@vxrerp/core/contracts';
import { CollectionMethodEnum } from '@vxrerp/core/contracts';

export const COLLECTION_METHOD_LABELS: Record<CollectionMethod, string> = {
  [CollectionMethodEnum.CHARGE_AUTOMATICALLY]: 'Tự động trừ thẻ',
  [CollectionMethodEnum.SEND_INVOICE]: 'Gửi hoá đơn',
  [CollectionMethodEnum.OFFSET_TICKET]: 'Cấn trừ tiền vé',
  [CollectionMethodEnum.DEBIT_WALLET]: 'Trừ ví nhà xe',
};
