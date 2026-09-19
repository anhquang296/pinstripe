import type {
  CollectionMethod,
  InvoiceStatus,
  PortalPaymentChannel,
  PortalRole,
  RecurringInterval,
  SubscriptionStatus,
} from '@pinstripe/core/contracts';
import {
  CollectionMethodEnum,
  InvoiceStatusEnum,
  PortalPaymentChannelEnum,
  PortalRoleEnum,
  RecurringIntervalEnum,
  SubscriptionStatusEnum,
} from '@pinstripe/core/contracts';

export type StatusTone = 'success' | 'warning' | 'danger' | 'default';

export interface StatusLabel {
  label: string;
  tone: StatusTone;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, StatusLabel> = {
  [InvoiceStatusEnum.DRAFT]: { label: 'Bản nháp', tone: 'default' },
  [InvoiceStatusEnum.OPEN]: { label: 'Chưa thanh toán', tone: 'warning' },
  [InvoiceStatusEnum.PAID]: { label: 'Đã thanh toán', tone: 'success' },
  [InvoiceStatusEnum.VOID]: { label: 'Đã hủy', tone: 'default' },
  [InvoiceStatusEnum.UNCOLLECTIBLE]: { label: 'Không thu được', tone: 'danger' },
};

export const OVERDUE_INVOICE_LABEL: StatusLabel = { label: 'Quá hạn', tone: 'danger' };

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, StatusLabel> = {
  [SubscriptionStatusEnum.INCOMPLETE]: { label: 'Chưa hoàn tất', tone: 'warning' },
  [SubscriptionStatusEnum.INCOMPLETE_EXPIRED]: { label: 'Hết hạn kích hoạt', tone: 'default' },
  [SubscriptionStatusEnum.TRIALING]: { label: 'Dùng thử', tone: 'warning' },
  [SubscriptionStatusEnum.ACTIVE]: { label: 'Đang sử dụng', tone: 'success' },
  [SubscriptionStatusEnum.PAST_DUE]: { label: 'Quá hạn thanh toán', tone: 'danger' },
  [SubscriptionStatusEnum.UNPAID]: { label: 'Chưa thanh toán', tone: 'danger' },
  [SubscriptionStatusEnum.PAUSED]: { label: 'Tạm dừng', tone: 'default' },
  [SubscriptionStatusEnum.CANCELED]: { label: 'Đã hủy', tone: 'default' },
};

export const COLLECTION_METHOD_LABELS: Record<CollectionMethod, string> = {
  [CollectionMethodEnum.CHARGE_AUTOMATICALLY]: 'Tự động thu qua thẻ',
  [CollectionMethodEnum.SEND_INVOICE]: 'Chuyển khoản theo hóa đơn',
  [CollectionMethodEnum.OFFSET_TICKET]: 'Cấn trừ tiền bán vé',
  [CollectionMethodEnum.DEBIT_WALLET]: 'Trừ ví nhà xe',
};

export const PORTAL_ROLE_LABELS: Record<PortalRole, string> = {
  [PortalRoleEnum.OWNER]: 'Chủ xe',
  [PortalRoleEnum.ACCOUNTANT]: 'Kế toán nhà xe',
};

export const PAYMENT_CHANNEL_LABELS: Record<PortalPaymentChannel, string> = {
  [PortalPaymentChannelEnum.CARD]: 'Thẻ / cổng thanh toán',
  [PortalPaymentChannelEnum.OFFSET_TICKET]: 'Cấn trừ tiền bán vé',
  [PortalPaymentChannelEnum.DEBIT_WALLET]: 'Trừ ví nhà xe',
  [PortalPaymentChannelEnum.RECORDED]: 'Chuyển khoản (kế toán ghi nhận)',
};

export const RECURRING_INTERVAL_LABELS: Record<RecurringInterval, string> = {
  [RecurringIntervalEnum.DAY]: 'ngày',
  [RecurringIntervalEnum.WEEK]: 'tuần',
  [RecurringIntervalEnum.MONTH]: 'tháng',
  [RecurringIntervalEnum.YEAR]: 'năm',
};
