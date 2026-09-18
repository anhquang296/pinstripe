# 0020 — Dòng tiền

- **Trạng thái.** Accepted
- **Phase.** 19 — Dòng tiền
- **Xây trên.** [0019 — Mô hình payment](0019-payment-model.md), [0003 — Sổ cái](0003-phase-2-ledger.md)

## Bối cảnh

Đến hết phase 18, mỗi lần thu tiền ghi thẳng `DEBIT cash / CREDIT accounts_receivable`. Nghĩa là sổ
cái tin rằng tiền vào tài khoản ngân hàng ngay lúc khách quẹt thẻ. Không có chỗ nào mô tả phần tiền
PSP đang giữ, không có phí xử lý, không có ngày tiền khả dụng, và câu hỏi "hôm nay PSP đang giữ bao
nhiêu của tôi" không trả lời được bằng dữ liệu có sẵn.

Refund thì gắn vào `payment_intents` chứ không vào `charges`, chỉ có một trạng thái ngầm là "đã
xong", và credit note là một số tiền trần trụi: không dòng chi tiết, không phân biệt trước hay sau
khi thu tiền, không void được.

## Quyết định

### 1. Tiền đi qua số dư của PSP

Đây là quyết định bị ép phải chốt của phase. Tiền **không** về thẳng ngân hàng: nó nằm ở số dư PSP
rồi mới được chuyển về. Payout vì thế là một cỗ máy chuyển tiền có trạng thái, không phải một object
báo cáo.

Bốn tài khoản mới, đều cộng thêm chứ không sửa lại bộ cũ:

| Mã                 | Loại    | Ý nghĩa                                        |
| ------------------ | ------- | ---------------------------------------------- |
| `psp_receivable`   | asset   | PSP đang giữ bao nhiêu của mình                |
| `psp_fees`         | expense | phí xử lý PSP đã trừ                           |
| `disputes_held`    | asset   | tiền bị giữ lại vì một dispute chưa ngã ngũ    |
| `payouts_clearing` | asset   | tiền đã rời số dư PSP nhưng chưa vào ngân hàng |

Một charge settle vì thế ghi ba chân thay vì hai:

```
DEBIT  psp_receivable   net
DEBIT  psp_fees         fee
CREDIT accounts_receivable (hoặc revenue nếu charge không gắn hoá đơn)  gross
```

`InvoiceService.settleInvoice` **không** còn ghi cash receipt khi khoản thanh toán đến từ một charge
— chân sổ cái do `BalanceService.recordChargeSettlement` ghi, trong cùng transaction. Thanh toán
ngoài luồng (`payInvoice` không có charge) vẫn ghi thẳng vào `cash` như cũ.

### 2. `balance_transactions` là sổ quỹ phía PSP

Mỗi chuyển động của số dư là một hàng: `type` (`charge` / `refund` / `dispute` / `dispute_reversal` /
`adjustment`), `gross`, `fee`, `net`, `availableOn`, `sourceType` + `sourceId`, và `payoutId` khi đã
được một payout quét đi.

`availableOn` là `createdAt + 2 ngày`. `GET /v1/balance` đọc từ đây:

- `available` — tổng `net` chưa thuộc payout nào và đã tới `availableOn`
- `pending` — tổng `net` chưa thuộc payout nào và chưa tới `availableOn`
- `reserved` — số dư tài khoản `disputes_held`

Hai bất biến mà test giữ:

- `sum(balance_transactions.net) == cash + psp_receivable` — payout chỉ **dời** tiền giữa hai tài
  khoản đó nên không sinh balance transaction; dispute rút tiền khỏi cả hai vế nên vẫn cân.
- `available + pending == psp_receivable`.

### 3. Payout là máy trạng thái, không phải một dòng báo cáo

`createPayout` quét **toàn bộ** số dư khả dụng của một currency (không có tham số `amount`: một
payout lấy hết phần đang khả dụng), gán `payoutId` cho từng balance transaction đã quét, ghi
`DEBIT payouts_clearing / CREDIT psp_receivable`, trạng thái `in_transit`.

`PayoutWorkflow` trong worker poll mỗi `PAYOUT_SETTLE_POLL_INTERVAL_MS`, gọi PSP cho những payout đã
tới `arrivalAt`; callback `payout.paid` ghi `DEBIT cash / CREDIT payouts_clearing` và phát
`payout.paid`. Callback `payout.failed` đảo bút toán, **gỡ** `payoutId` khỏi các balance transaction
để chúng quay lại số dư khả dụng, và phát `payout.failed`.

### 4. Dispute giữ tiền, và kéo theo subscription

`dispute.created` từ PSP ghi một hàng `disputes`, bút toán
`DEBIT disputes_held / CREDIT psp_receivable`, một balance transaction âm, rồi gọi
`subscriptionService.handleInvoicePaymentFailed(..., isFinal: false)` và đồng bộ entitlement —
subscription về `past_due`, quyền dùng vẫn còn trong lúc chờ.

`dispute.closed`:

- **won** → `DEBIT psp_receivable / CREDIT disputes_held`, balance transaction dương bằng đúng số đã
  giữ (tổng hai hàng của một dispute thắng bằng 0), subscription quay lại `active`.
- **lost** → `DEBIT revenue / CREDIT disputes_held` (tiền mất thật, không có balance transaction vì
  nó đã rời số dư từ lúc mở), `handleInvoicePaymentFailed(..., isFinal: true)` → `unpaid` và
  entitlement `blocked`.

Evidence nộp qua `POST /v1/disputes/:id/evidence`, đẩy dispute sang `under_review`.

### 5. Refund về cấp charge, trạng thái sống trong bảng transition

`createRefund` nhận `chargeId` chứ không phải `paymentIntentId`; một charge chịu được nhiều refund
miễn còn phần chưa hoàn. Refund tạo ra ở trạng thái `pending`; PSP trả `refund.succeeded` /
`refund.failed`; lúc succeeded mới ghi `DEBIT revenue / CREDIT psp_receivable`, cộng
`charges.amount_refunded` và phát `refund.updated`.

`refunds` và `credit_notes` đang bị trigger chặn UPDATE/DELETE, và phase này **giữ nguyên** tính
append-only đó: trạng thái chuyển được sống trong hai bảng phụ cũng append-only,
`refund_transitions` và `credit_note_transitions`. Trạng thái hiện tại là transition mới nhất. Đây
là cảnh báo kiến trúc của roadmap, chọn phương án hai như roadmap đề nghị.

### 6. Credit note đầy đủ

`credit_note_line_items` (append-only) mô tả từng dòng; tổng các dòng là `amount`. `type` do dữ liệu
quyết định chứ không do người gọi khai:

- Hoá đơn chưa trả đồng nào → `pre_payment`: ghi `DEBIT revenue / CREDIT accounts_receivable`, giảm
  số còn nợ, và settle hoá đơn nếu che hết phần còn lại. `refundAmount` / `outOfBandAmount` bị từ
  chối — chưa thu thì không có gì để trả lại.
- Hoá đơn đã trả → `post_payment`: `amount` chia làm ba phần `refundAmount` (tạo một refund thật, gắn
  `credit_notes.refund_id` và `refunds.credit_note_id`), `outOfBandAmount` (`CREDIT cash` — đã trả
  ngoài hệ thống), và phần còn lại vào số dư khách (`CREDIT customer_credit_balance` + một
  `customer_balance_transactions`).

`POST /v1/credit_notes/:id/void` đảo **đúng** ledger transaction của credit note đó
(`credit_notes.ledger_transaction_id`) và ghi transition `void`. Chỉ void được credit note chưa trả
lại đồng nào và hoá đơn còn `open` — đã hoàn tiền thì sửa bằng một credit note mới, không bằng void.

### 7. Reconciliation v2

Xem [flow 11](../flows/11-reporting-reconciliation.md). Hai thay đổi: phân trang thật theo con trỏ
(`SCAN_LIMIT = 1000` cũ cắt cụt trong im lặng), và chiều thứ ba `invoice_payments` để bắt trường hợp
charge có tiền mà hoá đơn không ghi nhận (`missing_in_invoices`).

## Hệ quả

- **`cash` không còn nhúc nhích khi khách trả tiền.** Nó chỉ đổi khi một payout về tới ngân hàng,
  hoặc khi có khoản thu / trả ngoài luồng. Báo cáo `collectedInWindow` vì thế đọc ra số tiền **đã về
  ngân hàng**, không phải số đã thu của khách.
- **Balance mới settle luôn là `pending`.** Một payout ngay sau khi thu tiền sẽ bị từ chối với 409.
  Test muốn payout phải kéo `available_on` lùi lại.
- **Fee bị kẹp trần bằng `gross`.** Với khoản thu nhỏ hơn phí cố định, `net` là 0 và chân posting 0
  bị loại bỏ thay vì vi phạm ràng buộc `amount > 0` của `ledger_postings`.
- **`createRefund` đổi chữ ký.** `paymentIntentId` không còn là đầu vào; admin-ui hoàn tiền theo
  `latestChargeId`.

## Cân nhắc đã bỏ

- **Tiền về thẳng ngân hàng, payout chỉ là object báo cáo.** Đơn giản hơn, nhưng khi ấy không có
  chỗ nào giữ được "PSP đang giữ bao nhiêu", `available` / `pending` mất nghĩa, và dispute không có
  tài khoản nào để rút tiền ra khỏi.
- **Bỏ trigger append-only trên `refunds` / `credit_notes` để thêm cột `status`.** Nhanh hơn nhiều,
  nhưng đánh đổi đúng thứ sổ cái được dựng để bảo vệ.
- **Payout sinh balance transaction (như Stripe).** Khi đó `sum(net)` bằng `psp_receivable` chứ
  không bằng `cash + psp_receivable`, và bất biến kiểm được bằng một câu SQL của phase này mất đi.
- **`availableOn` cấu hình bằng env.** Một hằng số hai ngày trong `balance.service.ts` đủ cho mock
  PSP; PSP thật sẽ tự nói ngày khả dụng của từng giao dịch.
