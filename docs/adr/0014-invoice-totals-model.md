# ADR 0014 — Mô hình tổng hoá đơn, hoá đơn rời và tách bút toán

Ngày: 2026-09-18. Trạng thái: đã triển khai (phase 13).

## Bối cảnh

Trước phase 13, hoá đơn là **một con số**: `subtotal = total = rated.total`, `postReceivable` ghi đúng
một cặp `accounts_receivable ↔ revenue`, và `finalizeInvoice` từ chối bất kỳ hoá đơn nào không có
`subscriptionId`. `invoice_line_items.price_id` là `NOT NULL` và dòng không có `description` hay
`unit_amount`, nên không có chỗ nào để đặt một dòng không sinh ra từ một price.

Ba thứ sắp tới đều ghi vào đúng hình dạng đó: coupon (phase 14), thuế (phase 15), credit note có dòng
(phase 19). Sổ cái bị trigger chặn `UPDATE`/`DELETE`, nên một hoá đơn đã ghi revenue gộp cả thuế là
lịch sử vĩnh viễn — chỉ sửa được bằng bút toán đảo từng cái. Đây là lý do mô hình tổng phải đúng
**trước** khi có khoản giảm giá đầu tiên.

## Quyết định

### 1. `total` đã gồm thuế; `subtotal` chưa trừ giảm giá

```
subtotal              = Σ line.amount
subtotalExcludingTax  = subtotal − thuế inclusive
totalDiscountAmount   = Σ line.discountAmounts
totalTaxAmount        = Σ line.taxAmounts
total                 = subtotal − totalDiscountAmount + thuế exclusive
```

Thuế `inclusive` đã nằm trong `line.amount` nên không cộng thêm lần nữa; nó chỉ tách ra ở
`subtotalExcludingTax` và `amountExcludingTax`. Phase 13 chưa có producer nào cho `discountAmounts`
và `taxAmounts` — cả hai luôn rỗng — nhưng công thức và cột đã ở đúng chỗ, nên phase 14/15 chỉ điền
dữ liệu chứ không phải viết lại migration.

### 2. Số dư khách áp ở **cấp hoá đơn**, không phải một dòng

Theo Stripe: `startingBalance` chốt tại thời điểm finalize, và

```
settled        = total + startingBalance
amountDue      = max(settled, 0)
endingBalance  = min(settled, 0)
```

Một công thức phục vụ cả hai chiều: `startingBalance < 0` là khách đang có credit và nó trừ vào
`amountDue`; `startingBalance > 0` là khách đang nợ và khoản nợ đó **dồn vào** hoá đơn này.

Hệ quả: `amountDue`, không phải `total`, là con số `payInvoice` và dunning làm việc với. `amountPaid`
so với `amountDue`.

`customers.balance` — cột tồn tại từ phase 1 mà **chưa một chỗ nào ghi** — bắt đầu được ghi ở đây,
luôn đi kèm một dòng `customer_balance_transactions`. Hàng đó là nguồn sự thật để đối chiếu; cột
`balance` là bản cache của nó.

### 3. Bút toán tách theo mô hình tổng

```
DEBIT   accounts_receivable      amountDue          (per customer)
DEBIT   customer_credit_balance  credit đã áp       (khi startingBalance < 0)
CREDIT  revenue                  total − thuế
CREDIT  tax_payable              thuế               (shared, không per-customer)
CREDIT  customer_credit_balance  nợ cũ dồn sang     (khi startingBalance > 0)
```

Hai vế luôn cân: nợ = `amountDue + |appliedBalance|` = `total ± startingBalance`, có = `revenue + tax
± startingBalance`. `voidInvoice` đảo đúng bộ đó và trả số dư khách về.

**`rounding_difference` chưa được dùng.** Nó chỉ sinh ra khi `money.allocate` chia giảm giá hoặc thuế
xuống từng dòng — tức là phase 14/15. Ghi lại ở đây để phase đó không đi tìm lý do cột này trống.

**Hợp đồng `externalId` của reconciliation không đổi.** `reconciliation.service.ts` chỉ đọc posting
trên tài khoản `cash`, và `postCashReceipt` giữ nguyên từng byte. Việc tách chỉ chạm nhánh phát hành.

### 4. Hoá đơn rời, và rating ba bước

`finalizeInvoice` không còn đòi `subscriptionId`. Nó chạy ba bước tách bạch:

1. **Gom dòng** — `collectInvoiceLines` = rating của subscription (nếu có) ∪ invoice item đang chờ của
   khách, cùng loại tiền.
2. **Ráp tổng** — `assembleInvoiceTotals(lines, startingBalance)`, thuần, không chạm I/O.
3. **Ghi** — dòng, số hoá đơn, tổng, số dư khách, bút toán, event.

Guard "kỳ của subscription phải khớp" chỉ còn áp cho hoá đơn **có** subscription.

### 5. `InvoiceItem` là dòng chờ, không phải dòng hoá đơn

`invoice_items` là hàng đợi của khách; `invoice_line_items` là thứ đã in lên hoá đơn. Một invoice item
được **đính** vào hoá đơn lúc finalize (`invoice_id` được set) và sinh ra một line item trỏ ngược lại
bằng `invoiceItemId`. Sửa hay xoá chỉ hợp lệ khi hoá đơn còn `draft` — sau đó `invoice_line_items` đã
append-only.

### 6. `autoAdvance` và `collectionMethod` bắt đầu có tác dụng

- `autoAdvance = true` + `draft` + `createdAt` cũ hơn `INVOICE_FINALIZE_DELAY_MS` → billing shard tự
  finalize. Cùng shard với billing run, không thêm queue.
- `collectionMethod = send_invoice` → `nextAttemptAt = null`, nên dunning **không** đụng vào nó.
  `offset_ticket` / `debit_wallet` (thêm sau, [ADR 0023](0023-operator-collection-methods.md)) được
  lên lịch như `charge_automatically`.
  `charge_automatically` giữ nguyên hành vi cũ.
- `daysUntilDue` ghi đè `INVOICE_DUE_DAYS` cho từng hoá đơn.

### 7. `paymentIntents.invoiceId` và `refunds.invoiceId` thành nullable ngay bây giờ

PaymentIntent độc lập phải tới phase 18 mới dùng, nhưng `payInvoice` đang được viết lại ở đây; làm hai
lần mới là lãng phí. Bảng `invoice_payments` (invoice ↔ payment intent ↔ số tiền) cũng dựng luôn và
`payInvoice` ghi vào nó, để phase 18 chỉ cần điền `paymentIntentId`.

### 8. `amountDue` thay `total` ở mọi chỗ hỏi "còn nợ bao nhiêu"

Ba call site đã đọc `total` và giờ phải đọc `amountDue`, nếu không thì một hoá đơn được credit trả một
phần sẽ cho phép thu quá:

| Nơi                                  | Trước                           | Sau                                 |
| ------------------------------------ | ------------------------------- | ----------------------------------- |
| `invoiceService.payInvoice`          | `total − amountPaid − credited` | `amountDue − amountPaid − credited` |
| `creditNoteService.createCreditNote` | `total − amountPaid − credited` | `amountDue − amountPaid − credited` |
| `reportingRepository` `outstanding`  | `total − amountPaid`            | `amountDue − amountPaid`            |

`invoiced` trong báo cáo doanh thu giữ `total`: đó là số đã phát hành, không phải số còn phải thu.

### 9. Hợp đồng `externalId` có test giữ

`ledger-contract.integration.test.ts` chốt ba thứ bằng cách đọc thẳng posting theo `externalId`:
cash receipt mang đúng `invoice_payment:<invoiceId>:<amountPaid>` mà reconciliation đi tìm; hoá đơn
phát hành tách đúng AR / revenue / credit balance và cân; void trả credit về đúng khách.
`LedgerTransactionFilters` vì thế có thêm `externalId` — trước đó không có cách nào đọc một giao dịch
theo tham chiếu của nó.

## Chệch có chủ ý so với `ROADMAP-V2.md`

- **`amountRemaining` không thành cột.** Nó phụ thuộc credit note và refund ở bảng khác; lưu thành cột
  sẽ đẻ ra một đường ghi thứ hai phải đồng bộ ở mọi nhánh. Giữ nguyên dạng dẫn xuất
  `amountDue − amountPaid − amountCredited`.
- **`money.allocate` và `rounding_difference` hoãn sang phase 14/15**, vì phase 13 chưa có gì để chia.

## Hệ quả

- Trigger `invoices_reject_issued_rewrite` nay khoá thêm sáu cột tiền mới. Một hoá đơn đã phát hành
  không sửa được thuế hay số dư đã áp.
- `BillingReason` mở đủ bộ Stripe (`subscription_create`, `subscription_threshold`, `manual`,
  `upcoming`); mới `manual` có producer.
- `LineItemType` thêm `invoiceitem`, `discount`, `tax`; mới `invoiceitem` có producer.
- Reporting vẫn cộng doanh thu bằng `invoices.total`, tức vẫn giả định `total` chưa có thuế tách ra.
  Đúng cho tới khi phase 15 có thuế suất đầu tiên — sửa ở đó, cùng lúc với `tax_payable`.
- `CustomerBalanceTransactionType` khai đủ bộ của cột `type`, nhưng mới ba member có producer:
  `adjustment`, `applied_to_invoice`, `unapplied_from_invoice`. `credit_note` chờ phase 19,
  `invoice_overpaid` chờ phase 18 — cùng lý do cột `credit_note_id` còn trống.
- SDK: `pinstripe.invoiceItems` (find/get/create/update/delete) và
  `pinstripe.customers.findBalanceTransactions` / `.createBalanceTransaction`, kèm hook React và
  context query `customer(id)._ctx.balanceTransactions`.
