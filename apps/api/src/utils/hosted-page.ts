import type { CheckoutSessionResponse, InvoiceResponse } from '@vxrerp/core/contracts';
import { CheckoutSessionStatusEnum } from '@vxrerp/core/contracts';
import _ from 'lodash';

const DEFAULT_TEST_CARD_TOKEN = 'tok_visa_ok';

function buildInvoiceLabel(invoice: InvoiceResponse): string {
  const { number } = invoice;

  if (number) {
    return number;
  }

  return invoice.id;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPage(title: string, body: string): string {
  return [
    '<!doctype html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    '<style>body{font-family:system-ui,sans-serif;margin:0;background:#f8fafc;color:#0f172a}',
    'main{max-width:40rem;margin:0 auto;padding:3rem 1.5rem;display:flex;flex-direction:column;gap:1.5rem}',
    'table{width:100%;border-collapse:collapse;background:#fff;border-radius:.75rem;overflow:hidden}',
    'th,td{text-align:left;padding:.75rem 1rem;border-bottom:1px solid #e2e8f0;font-size:.875rem}',
    'button{padding:.75rem 1.25rem;border:0;border-radius:.5rem;background:#0f172a;color:#fff;font-size:1rem}',
    'input{padding:.625rem .75rem;border:1px solid #cbd5f5;border-radius:.5rem;font-size:1rem;width:100%}',
    'form{display:flex;flex-direction:column;gap:.75rem;background:#fff;padding:1.5rem;border-radius:.75rem}',
    '</style>',
    '</head>',
    `<body><main>${body}</main></body>`,
    '</html>',
  ].join('');
}

export function buildCheckoutPage(
  checkoutSession: CheckoutSessionResponse,
  completeUrl: string,
): string {
  const rows = _(checkoutSession.lineItems)
    .map((lineItem) => {
      return `<tr><td>${escapeHtml(lineItem.priceId)}</td><td>${lineItem.quantity}</td><td>${lineItem.amountTotal}</td></tr>`;
    })
    .join('');

  const summary = `<table><thead><tr><th>Đơn giá</th><th>Số lượng</th><th>Thành tiền</th></tr></thead><tbody>${rows}</tbody></table>`;
  const total = `<p><strong>Tổng: ${checkoutSession.amountTotal} ${escapeHtml(checkoutSession.currency)}</strong></p>`;

  if (checkoutSession.status !== CheckoutSessionStatusEnum.OPEN) {
    return buildPage(
      'Phiên thanh toán đã đóng',
      `<h1>Phiên thanh toán đã ${escapeHtml(checkoutSession.status)}</h1>${summary}${total}`,
    );
  }

  const form = [
    `<form method="post" action="${escapeHtml(completeUrl)}">`,
    '<label for="token">Mã thẻ thử nghiệm</label>',
    `<input id="token" name="token" value="${DEFAULT_TEST_CARD_TOKEN}" />`,
    '<button type="submit">Thanh toán</button>',
    '</form>',
  ].join('');

  return buildPage('Thanh toán', `<h1>Hoàn tất thanh toán</h1>${summary}${total}${form}`);
}

export function buildInvoicePage(invoice: InvoiceResponse, pdfUrl: string): string {
  const rows = _(invoice.lineItems)
    .map((lineItem) => {
      return `<tr><td>${escapeHtml(lineItem.description)}</td><td>${lineItem.quantity}</td><td>${lineItem.amount}</td></tr>`;
    })
    .join('');

  const body = [
    `<h1>Hoá đơn ${escapeHtml(buildInvoiceLabel(invoice))}</h1>`,
    `<p>Trạng thái: ${escapeHtml(invoice.status)}</p>`,
    `<table><thead><tr><th>Nội dung</th><th>Số lượng</th><th>Thành tiền</th></tr></thead><tbody>${rows}</tbody></table>`,
    `<p><strong>Tổng: ${invoice.total} ${escapeHtml(invoice.currency)}</strong></p>`,
    `<p><strong>Còn phải trả: ${invoice.amountRemaining} ${escapeHtml(invoice.currency)}</strong></p>`,
    `<p><a href="${escapeHtml(pdfUrl)}">Tải bản PDF</a></p>`,
  ].join('');

  return buildPage(`Hoá đơn ${buildInvoiceLabel(invoice)}`, body);
}
