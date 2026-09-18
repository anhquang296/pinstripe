import type { NotificationKind } from '@queues/notification.queue';
import { NotificationKindEnum } from '@queues/notification.queue';
import type { Currency } from '@utils/currency';
import { Money } from '@utils/money';
import _ from 'lodash';

export interface NotificationContext {
  customerName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: Currency;
  declineCode: string | null;
  nextAttemptAt: Date | null;
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
    return `invoice ${invoiceNumber}`;
  }

  return 'your account';
}

function buildAmountLabel(amount: number, currency: Currency): string {
  return Money.of(amount, currency).toString();
}

function buildUrlLabel(url: string | null): string {
  if (url) {
    return url;
  }

  return 'your billing portal';
}

function buildNotificationBody(
  kind: NotificationKind,
  context: NotificationContext,
): NotificationBody {
  const invoiceLabel = buildInvoiceLabel(context.invoiceNumber);
  const amountLabel = buildAmountLabel(context.amount, context.currency);

  if (kind === NotificationKindEnum.INVOICE_FINALIZED) {
    return {
      subject: `Your ${invoiceLabel} is ready`,
      lines: [
        `We have issued ${invoiceLabel} for ${amountLabel}.`,
        'You can settle it from your billing portal at any time.',
      ],
    };
  }

  if (kind === NotificationKindEnum.INVOICE_SENT) {
    const urlLabel = buildUrlLabel(context.url);

    return {
      subject: `Your ${invoiceLabel} for ${amountLabel}`,
      lines: [
        `We have issued ${invoiceLabel} for ${amountLabel}.`,
        `You can read it, download the PDF and pay it here: ${urlLabel}`,
      ],
    };
  }

  if (kind === NotificationKindEnum.PORTAL_MAGIC_LINK) {
    const urlLabel = buildUrlLabel(context.url);

    return {
      subject: 'Your billing portal sign-in link',
      lines: [
        'Use this link to open your billing portal. It works once and expires shortly.',
        urlLabel,
      ],
    };
  }

  if (kind === NotificationKindEnum.PAYMENT_SUCCEEDED) {
    return {
      subject: `Payment received for ${invoiceLabel}`,
      lines: [
        `Thank you. We received ${amountLabel} for ${invoiceLabel}.`,
        'No further action is needed.',
      ],
    };
  }

  if (kind === NotificationKindEnum.PAYMENT_METHOD_SAVED) {
    return {
      subject: 'Your payment method is saved',
      lines: [
        'Your card is now saved and will be used for future charges.',
        'You can replace it from your billing portal at any time.',
      ],
    };
  }

  if (kind === NotificationKindEnum.PAYMENT_ABANDONED) {
    return {
      subject: `We could not collect ${invoiceLabel}`,
      lines: [
        `We tried several times to collect ${amountLabel} for ${invoiceLabel} and every attempt was declined.`,
        'Please update your payment method to keep your subscription active.',
      ],
    };
  }

  const retryLine = context.nextAttemptAt
    ? `We will try again on ${context.nextAttemptAt.toISOString()}.`
    : 'We will not try this card again.';

  return {
    subject: `Your payment for ${invoiceLabel} was declined`,
    lines: [
      `A charge of ${amountLabel} for ${invoiceLabel} was declined by your bank.`,
      context.declineCode ? `The bank reported: ${context.declineCode}.` : 'No reason was given.',
      retryLine,
    ],
  };
}

export function buildNotificationEmail(
  kind: NotificationKind,
  context: NotificationContext,
): NotificationEmail {
  const { subject, lines } = buildNotificationBody(kind, context);
  const greeting = context.customerName ? `Hello ${context.customerName},` : 'Hello,';
  const paragraphs = [greeting, ...lines];

  return {
    subject,
    text: paragraphs.join('\n\n'),
    html: _(paragraphs)
      .map((paragraph) => {
        return `<p>${paragraph}</p>`;
      })
      .join(''),
  };
}
