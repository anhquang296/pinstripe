import type { NotificationKind } from '@queues/notification.queue';
import { NotificationKindEnum } from '@queues/notification.queue';
import type { Currency } from '@utils/currency';
import { Money } from '@utils/money';
import _ from 'lodash';

const TEMPLATE_LOCALE = 'vi-VN';
const TEMPLATE_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export interface NotificationContext {
  customerName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: Currency;
  declineCode: string | null;
  nextAttemptAt: Date | null;
  dueAt: Date | null;
  url: string | null;
}

export interface NotificationEmail {
  subject: string;
  text: string;
  html: string;
}

interface NotificationBody {
  subject: string;
  lines: string[];
}

function buildInvoiceLabel(invoiceNumber: string | null): string {
  if (invoiceNumber) {
    return `hóa đơn ${invoiceNumber}`;
  }

  return 'tài khoản của quý khách';
}

function buildAmountLabel(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(TEMPLATE_LOCALE, {
    style: 'currency',
    currency: _.toUpper(currency),
  }).format(Money.of(amount, currency).toMajorUnit());
}

function buildDateLabel(date: Date | null): string {
  if (date) {
    return new Intl.DateTimeFormat(TEMPLATE_LOCALE, {
      timeZone: TEMPLATE_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  return 'chưa xác định';
}

function buildUrlLine(url: string | null, prompt: string): string[] {
  if (url) {
    return [`${prompt}: ${url}`];
  }

  return [];
}

function buildNotificationBody(
  kind: NotificationKind,
  context: NotificationContext,
): NotificationBody {
  const invoiceLabel = buildInvoiceLabel(context.invoiceNumber);
  const amountLabel = buildAmountLabel(context.amount, context.currency);
  const dueLabel = buildDateLabel(context.dueAt);

  if (kind === NotificationKindEnum.INVOICE_FINALIZED) {
    return {
      subject: `Vexere đã phát hành ${invoiceLabel}`,
      lines: [
        `Vexere đã phát hành ${invoiceLabel} với số tiền ${amountLabel}.`,
        'Quý khách có thể xem và thanh toán trên cổng nhà xe bất cứ lúc nào.',
      ],
    };
  }

  if (kind === NotificationKindEnum.INVOICE_SENT) {
    return {
      subject: `${_.upperFirst(invoiceLabel)} — ${amountLabel}`,
      lines: [
        `Vexere đã phát hành ${invoiceLabel} với số tiền ${amountLabel}.`,
        ...buildUrlLine(context.url, 'Xem hóa đơn, tải bản PDF tại'),
      ],
    };
  }

  if (kind === NotificationKindEnum.INVOICE_DUE_SOON) {
    return {
      subject: `Nhắc thanh toán: ${invoiceLabel} đến hạn ngày ${dueLabel}`,
      lines: [
        `${_.upperFirst(invoiceLabel)} còn ${amountLabel} chưa thanh toán và sẽ đến hạn vào ngày ${dueLabel}.`,
        'Quý khách vui lòng thanh toán đúng hạn để dịch vụ không bị gián đoạn.',
        ...buildUrlLine(context.url, 'Xem hóa đơn và thông tin chuyển khoản'),
      ],
    };
  }

  if (kind === NotificationKindEnum.INVOICE_OVERDUE) {
    return {
      subject: `${_.upperFirst(invoiceLabel)} đã quá hạn thanh toán`,
      lines: [
        `${_.upperFirst(invoiceLabel)} đã quá hạn từ ngày ${dueLabel}, số tiền còn phải trả là ${amountLabel}.`,
        'Quý khách vui lòng thanh toán sớm. Nếu đã chuyển khoản, xin bỏ qua thư này.',
        ...buildUrlLine(context.url, 'Xem hóa đơn và thông tin chuyển khoản'),
      ],
    };
  }

  if (kind === NotificationKindEnum.INVOICE_OVERDUE_INTERNAL) {
    return {
      subject: `[Nội bộ] ${context.customerName}: ${invoiceLabel} quá hạn`,
      lines: [
        `Nhà xe ${context.customerName} chưa thanh toán ${invoiceLabel}, quá hạn từ ngày ${dueLabel}.`,
        `Số tiền còn phải thu: ${amountLabel}. Đề nghị kế toán và AM phụ trách liên hệ nhà xe.`,
      ],
    };
  }

  if (kind === NotificationKindEnum.PORTAL_MAGIC_LINK) {
    return {
      subject: 'Đường dẫn đăng nhập cổng nhà xe Vexere',
      lines: [
        'Bấm vào đường dẫn dưới đây để đăng nhập cổng nhà xe. Đường dẫn chỉ dùng được một lần và hết hạn sau ít phút.',
        ...buildUrlLine(context.url, 'Đăng nhập'),
        'Nếu quý khách không yêu cầu đăng nhập, xin bỏ qua thư này.',
      ],
    };
  }

  if (kind === NotificationKindEnum.PAYMENT_SUCCEEDED) {
    return {
      subject: `Đã nhận thanh toán cho ${invoiceLabel}`,
      lines: [
        `Cảm ơn quý khách. Vexere đã nhận ${amountLabel} cho ${invoiceLabel}.`,
        'Quý khách không cần làm gì thêm.',
      ],
    };
  }

  if (kind === NotificationKindEnum.PAYMENT_METHOD_SAVED) {
    return {
      subject: 'Phương thức thanh toán đã được lưu',
      lines: [
        'Thẻ của quý khách đã được lưu và sẽ được dùng cho các kỳ thanh toán tiếp theo.',
        'Quý khách có thể thay thẻ khác trên cổng nhà xe.',
      ],
    };
  }

  if (kind === NotificationKindEnum.PAYMENT_ABANDONED) {
    return {
      subject: `Không thu được ${invoiceLabel}`,
      lines: [
        `Vexere đã thử thu ${amountLabel} cho ${invoiceLabel} nhiều lần nhưng đều bị từ chối.`,
        'Quý khách vui lòng cập nhật phương thức thanh toán để gói dịch vụ tiếp tục hoạt động.',
      ],
    };
  }

  const declineLine = context.declineCode
    ? `Ngân hàng trả về mã: ${context.declineCode}.`
    : 'Ngân hàng không cho biết lý do.';
  const retryLine = context.nextAttemptAt
    ? `Vexere sẽ thử lại vào ${context.nextAttemptAt.toISOString()}.`
    : 'Vexere sẽ không thử lại với thẻ này.';

  return {
    subject: `Thanh toán cho ${invoiceLabel} bị từ chối`,
    lines: [
      `Khoản thu ${amountLabel} cho ${invoiceLabel} đã bị ngân hàng từ chối.`,
      declineLine,
      retryLine,
    ],
  };
}

export function buildNotificationEmail(
  kind: NotificationKind,
  context: NotificationContext,
): NotificationEmail {
  const { subject, lines } = buildNotificationBody(kind, context);
  const greeting = context.customerName
    ? `Kính gửi ${context.customerName},`
    : 'Kính gửi quý khách,';
  const paragraphs = [greeting, ...lines, 'Trân trọng,\nVexere'];

  return {
    subject,
    text: paragraphs.join('\n\n'),
    html: _(paragraphs)
      .map((paragraph) => {
        return `<p>${_.escape(paragraph).replace(/\n/g, '<br>')}</p>`;
      })
      .join(''),
  };
}
