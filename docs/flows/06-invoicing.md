# Flow 06 — Hoá đơn và credit note

Vòng đời một hoá đơn: nháp → phát hành → thu tiền → (huỷ hoặc ghi giảm). Đây là nơi rating ([flow 05](./05-metering-and-rating.md)) biến thành con số cố định, và là nơi mọi bút toán sổ cái ([flow 10](./10-ledger.md)) được sinh ra.

## Khi nào chạy

| Route                                       | Việc                                                    |
| ------------------------------------------- | ------------------------------------------------------- |
| `GET /v1/invoices/upcoming?subscriptionId=` | xem trước, **không** ghi gì — gọi thẳng `ratingService` |
| `POST /v1/invoices`                         | tạo nháp cho kỳ hiện tại                                |
| `POST /v1/invoices/:invoiceId/finalize`     | chốt số tiền, cấp số hoá đơn                            |
| `POST /v1/invoices/:invoiceId/pay`          | ghi nhận tiền về                                        |
| `POST /v1/invoices/:invoiceId/void`         | huỷ                                                     |
| `POST /v1/credit_notes`                     | ghi giảm phần chưa trả                                  |

Ngoài ra `ensureDraftInvoice` được [billing run](./08-billing-run.md) gọi định kỳ.

## Máy trạng thái

[invoices.types.ts:23-33](../../packages/core/src/contracts/invoices.types.ts):

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> open : finalize
    draft --> void
    open --> paid : pay đủ
    open --> void
    open --> uncollectible : dunning bó tay
    uncollectible --> paid
    paid --> [*]
    void --> [*]
```

`paid` và `void` là trạng thái cuối. `uncollectible` vẫn quay lại `paid` được — khách trả muộn thì vẫn ghi nhận.

## Tạo nháp

`ensureDraftInvoice` — [invoice.service.ts:53-110](../../packages/core/src/services/invoice.service.ts) — idempotent theo kỳ:

1. `findPeriodInvoice` tìm hoá đơn `billing_reason = subscription_cycle` có `periodStart` trùng `subscription.currentPeriodStart` — có rồi thì trả về, `isCreated: false`.
2. Chưa có → INSERT nháp (`subtotal`/`total`/`amountPaid` = 0, `number` = `null`) + event `invoice.created`.
3. Đụng unique violation (hai tiến trình chạy cùng lúc) → tìm lại, trả hoá đơn của kẻ thắng cuộc.

Bước 3 là lý do billing run chạy nhiều shard song song vẫn không tạo hoá đơn trùng.

## Hai lý do phát hành

`billing_reason` phân biệt hai loại hoá đơn dùng chung một kỳ:

| `billing_reason`      | Ai tạo                                                       | Phủ gì                                 |
| --------------------- | ------------------------------------------------------------ | -------------------------------------- |
| `subscription_cycle`  | billing run, sau khi kỳ kết thúc                             | toàn bộ item còn cửa sổ mở trong kỳ    |
| `subscription_update` | `updateSubscription` với `prorationBehavior: always_invoice` | các cửa sổ vừa đóng, chưa xuất hoá đơn |

Tính duy nhất "một hoá đơn mỗi kỳ" vì thế là **partial**: `UNIQUE (subscription_id, period_start) WHERE billing_reason = 'subscription_cycle'`.

> `findPeriodInvoice` **bắt buộc** lọc theo `billing_reason`. Không lọc, nó trả về hoá đơn proration như "draft của kỳ này", `ensureDraftInvoice` báo `isCreated: false`, và billing run âm thầm ngừng draft — không có gì throw. Xem [ADR 0013](../adr/0013-arrears-proration.md).

Hoá đơn `subscription_update` được tạo, phát hành và post sổ cái **trong cùng transaction** với lần đổi item, nên một lần update bị từ chối không để lại hoá đơn mồ côi. Nó vào dunning như mọi hoá đơn OPEN khác.

## Finalize — bước quan trọng nhất

| #   | Nơi xảy ra                                                                        | Làm gì                                                                                        |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | [invoice.service.ts:115](../../packages/core/src/services/invoice.service.ts)     | `assertTransition(status → open)`                                                             |
| 2   | [invoice.service.ts:123-127](../../packages/core/src/services/invoice.service.ts) | `subscription.currentPeriodStart` phải còn khớp `invoice.periodStart`, lệch → `ConflictError` |
| 3   | [invoice.service.ts:129](../../packages/core/src/services/invoice.service.ts)     | `ratingService.rateUpcomingInvoice` — tính tiền **tại thời điểm này**                         |
| 4   | [invoice.service.ts:419](../../packages/core/src/services/invoice.service.ts)     | `discountService.applyDiscounts` — ghi `discountAmounts` xuống từng dòng, trước khi ráp tổng  |
| 4b  | [tax.service.ts](../../packages/core/src/services/tax.service.ts)                 | `taxService.applyTaxes` — thuế trên `amount - discountAmounts`, đóng băng snapshot thuế suất  |
| 5   | [invoice.service.ts:131](../../packages/core/src/services/invoice.service.ts)     | `dueAt = now + INVOICE_DUE_DAYS`                                                              |
| 6   | [invoice.service.ts:149-156](../../packages/core/src/services/invoice.service.ts) | `claimNumberSequence(INVOICE)` trong transaction — cấp số từ `number_sequences`               |
| 7   | [invoice.service.ts:158](../../packages/core/src/services/invoice.service.ts)     | INSERT `invoice_line_items` — bản chụp bất biến của kết quả rating                            |
| 7b  | [invoice.service.ts](../../packages/core/src/services/invoice.service.ts)         | INSERT `invoice_line_item_tax_amounts` — một hàng cho mỗi thuế suất áp lên mỗi dòng           |
| 8   | [invoice.service.ts:160-173](../../packages/core/src/services/invoice.service.ts) | UPDATE: `number = INV-000123`, `status = open`, `subtotal`/`total`, `nextAttemptAt = dueAt`   |
| 9   | [postReceivable:336-362](../../packages/core/src/services/invoice.service.ts)     | bút toán: **Nợ** `accounts_receivable` (theo khách) / **Có** `revenue` + `tax_payable`        |
| 10  | [invoice.service.ts:180](../../packages/core/src/services/invoice.service.ts)     | event `invoice.finalized`                                                                     |

Bước 2 chặn một lỗi cụ thể: subscription đã sang kỳ mới trong lúc hoá đơn còn nháp thì rating sẽ trả về số của kỳ **mới**, dán nhầm vào hoá đơn của kỳ **cũ**.

Số hoá đơn cấp bằng `claimNumberSequence` bên trong transaction — [invoice.service.ts:511-513](../../packages/core/src/services/invoice.service.ts) định dạng `INV-` + 6 chữ số. Bảng `number_sequences` bảo đảm dãy số liên tục, không nhảy cóc (yêu cầu kế toán ở nhiều nơi).

Sau finalize, migration `0011_invoice_immutability` khoá các cột tiền ở tầng DB — muốn sửa thì void hoặc ghi credit note, không UPDATE.

## Thu tiền

`payInvoice` — [invoice.service.ts:188-239](../../packages/core/src/services/invoice.service.ts):

```
owed = total − amountPaid − amountCredited
```

- `amount` không truyền thì mặc định bằng `owed`; vượt `owed` → `BadRequestError`.
- `isSettled = amountPaid + amountCredited === total` — chỉ khi đó mới chuyển `paid`, ghi `paidAt` và bắn `invoice.paid`. Trả thiếu thì hoá đơn vẫn `open`, chỉ tăng `amountPaid`.
- Bút toán: **Nợ** `cash` / **Có** `accounts_receivable` — [postCashReceipt:364-391](../../packages/core/src/services/invoice.service.ts).
- `externalId` của bút toán là `settlementReference` nếu có (do [flow 07](./07-payments-and-refunds.md) truyền vào), không thì `invoice_payment:<id>:<amountPaid>`. Đây là khoá chống ghi sổ hai lần.

## Void

`voidInvoice` — [invoice.service.ts:241-280](../../packages/core/src/services/invoice.service.ts):

- `amountPaid > 0` → `ConflictError`, buộc dùng credit note. Không bao giờ xoá dấu vết tiền đã nhận.
- Chỉ hoá đơn đang `open` mới đảo bút toán (`reverseReceivable`: **Nợ** `revenue` / **Có** `accounts_receivable`) — nháp chưa từng ghi sổ nên không có gì để đảo.

## Credit note

`createCreditNote` — [credit-note.service.ts:25-87](../../packages/core/src/services/credit-note.service.ts):

Payload mang `lines[]`; tổng các dòng là `amount` của credit note. `type` do dữ liệu quyết định, người gọi không khai:

| `type`         | Khi nào                   | Kiểm tra                                                     | Bút toán                                                                                                     |
| -------------- | ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `pre_payment`  | hoá đơn chưa trả đồng nào | `amount <= amountDue − amountPaid − đã credit`               | **Nợ** `revenue` / **Có** `accounts_receivable`                                                              |
| `post_payment` | hoá đơn đã trả            | `amount <= amountPaid − đã credit`, `refund + oob <= amount` | phần hoàn tiền do refund ghi; `outOfBandAmount` **Có** `cash`; phần còn lại **Có** `customer_credit_balance` |

Hoá đơn không được là `draft` — nháp thì sửa thẳng, không cần ghi giảm.

Ghi xong: cấp số `CN-000045` từ cùng cơ chế `number_sequences`, event `credit_note.created`. Với `pre_payment`, nếu credit vừa đúng phần còn lại thì hoá đơn chuyển sang `paid` và bắn `invoice.paid`.

`POST /v1/credit_notes/:id/void` đảo đúng ledger transaction của credit note và ghi transition `void`; chỉ void được credit note chưa trả lại đồng nào, trên hoá đơn còn `open`. Trạng thái sống trong `credit_note_transitions` vì `credit_notes` là append-only — [ADR 0020](../adr/0020-money-flow.md).

Ranh giới credit note ↔ refund là điểm hay lẫn: **chưa thu thì credit, đã thu thì chọn hoàn tiền, trả ngoài luồng, hay ghi vào số dư khách — cả ba đi qua một credit note `post_payment`.**

## Các con số trong response

`buildInvoiceWithLineItems` — [invoice.service.ts:523-566](../../packages/core/src/services/invoice.service.ts) — bổ sung ba số không nằm trong bảng `invoices`:

| Trường            | Nguồn                                 |
| ----------------- | ------------------------------------- |
| `amountCredited`  | tổng credit note của hoá đơn          |
| `amountRefunded`  | tổng refund                           |
| `amountRemaining` | `total − amountPaid − amountCredited` |

Chúng được tính lại mỗi lần đọc, không lưu — nên không bao giờ lệch với bảng nguồn.

## Bảng DB

| Bảng                            | Điểm cần nhớ                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `number_sequences`              | một hàng cho mỗi loại (`invoice`, `credit_note`); `claimNumberSequence` chạy trong transaction |
| `invoices`                      | `number` nullable tới khi finalize; `due_at`, `next_attempt_at` phục vụ dunning                |
| `invoice_line_items`            | bản chụp; sửa giá về sau không đổi hoá đơn cũ                                                  |
| `invoice_line_item_tax_amounts` | dòng thuế; mang snapshot `percentage`/`isInclusive`/`taxType`, tắt rate không đổi hoá đơn cũ   |
| `tax_rates`                     | `percentage` và `inclusive` bất biến; đổi thuế suất là tạo rate mới                            |
| `tax_ids`                       | `verification` do `TaxQueue` ghi; hôm nay verify là stub kiểm format                           |
| `credit_notes`                  | chỉ ghi thêm, không sửa; giữ `refund_id` và `ledger_transaction_id` để void đảo đúng bút toán  |
| `credit_note_line_items`        | append-only; tổng `amount` của các dòng là `amount` của credit note                            |
| `credit_note_transitions`       | append-only; transition mới nhất là trạng thái (`issued` / `void`)                             |

## Thuế

Thuế chỉ xuất hiện lúc finalize, theo thứ tự: thuế suất gắn vào dòng → `invoices.defaultTaxRates`
(hoá đơn chu kỳ thừa hưởng từ subscription) → tra bảng theo `country`/`state` khi
`automaticTax.enabled`. `customer.taxExempt` khác `none` thì không thu gì.

`total` chỉ cộng phần thuế **exclusive** — thuế inclusive đã nằm trong `subtotal`, và
`subtotalExcludingTax` là chỗ nhìn ra phần gốc. Chi tiết công thức, làm tròn inclusive qua
`Money.allocate`, và vì sao `authorityInvoiceNumber` tách khỏi `INV-000001`: [ADR 0016](../adr/0016-tax-model.md).

## Đọc tiếp

- [07 — Payments và refunds](./07-payments-and-refunds.md)
- [10 — Ledger](./10-ledger.md) — chi tiết 4 bút toán nói ở trên
- ADR: [0009 invoicing](../adr/0009-phase-6-invoicing.md)
