# 0023 — Thu tiền qua Vexere: `offset_ticket` và `debit_wallet`

- **Trạng thái.** Accepted
- **Xây trên.** [0014 — Mô hình tổng hoá đơn](0014-invoice-totals-model.md), [0020 — Dòng tiền](0020-money-flow.md)

## Bối cảnh

BRD SaaS Billing (`docs/brd/`) nói kênh thu chính của Vexere không phải thẻ mà là **cấn trừ tiền bán vé** và **trừ ví nhà xe**. Đến trước quyết định này pinstripe chỉ có hai collection method: `charge_automatically` (dunning quẹt thẻ qua PSP) và `send_invoice` (không tự thu). Doanh thu bán vé và số dư ví đều nằm ở hệ thống Vexere bên ngoài, không ở pinstripe.

## Quyết định

### 1. Hai giá trị mới trong `CollectionMethodEnum`

`offset_ticket` và `debit_wallet`. Cột `collection_method` là `text` không CHECK nên không cần DDL. Cả hai được coi là **thu tự động**: finalize đặt `nextAttemptAt = dueAt` giống `charge_automatically` (`AUTOMATIC_COLLECTION_METHODS` ở `constants/collection.ts`).

Chưa có collection timing (đầu kỳ / cuối kỳ / ngày trong kỳ / trước đầu kỳ). Hai method mới đi đúng đồng hồ `nextAttemptAt` hiện có.

### 2. Customer mang `vexereOperatorId`

`customers.vexere_operator_id` nullable: khách không thu qua Vexere thực sự không có mã nhà xe. Tạo hoặc đổi subscription / invoice sang method mới khi customer không có mã → `400` (`assertCollectionMethodUsable`).

### 3. `OperatorCollectionProvider` thay vì gọi thẳng HTTP

Interface ở `types/operator-collection-provider.ts`, hai method `offsetTicketSales` / `debitWallet`, trả `{ appliedAmount, reference }`. `appliedAmount` nằm trong `0…amount`: **trừ được một phần là kết quả hợp lệ**, không phải lỗi.

`vexere.plugin.ts` dùng `VexereClient` (HTTP, `VEXERE_API_URL` / `VEXERE_API_KEY` / `VEXERE_TIMEOUT_MS`) khi đủ cấu hình, ngược lại `MockVexereClient`. Path và hình dạng body của `VexereClient` là **tạm**: phía Vexere chưa có spec. Chốt spec thì chỉ sửa file client.

### 4. `collection_attempts` giữ idempotency qua ranh giới hệ thống

Gọi hệ thống ngoài rồi mới commit DB nên có thể crash giữa chừng. Mỗi lần thu là một hàng `pending`, **commit trước** khi gọi Vexere. `idempotencyKey = collection_attempts.id`. Lần dunning sau thấy hàng `pending` thì gọi lại **cùng key**, và Vexere trả lại kết quả cũ thay vì trừ lần hai.

Lỗi từ provider → attempt `failed` + `failure_message`. Lỗi DB sau khi Vexere đã trừ tiền → attempt vẫn `pending`, dunning thử lại với cùng key.

### 5. Trả một phần, còn lại nợ

`settleInvoice` vốn đã nhận `amount < owed`. Tiền trừ được ghi vào `amountPaid`; hoá đơn giữ `open`. `DunningService.collectFromOperator` rồi đi đúng nhánh retry của thẻ không có payment method (`scheduleRetryOrAbandon`): `attemptCount += 1`, hẹn theo `DUNNING_RETRY_DELAY_DAYS`, subscription → `past_due` / `incomplete`; hết lượt → `uncollectible`. Lần retry chỉ đòi `amountRemaining`.

Trả đủ → `handleInvoicePaymentSucceeded` đưa subscription về `active` và tiến `chargedThroughDate`.

### 6. Hai tài khoản clearing trong sổ cái

| Mã                         | Loại  | Số dư thường | Ý nghĩa                                        |
| -------------------------- | ----- | ------------ | ---------------------------------------------- |
| `ticket_offset_clearing`   | asset | debit        | tiền sẽ nhận về qua đối soát bán vé với nhà xe |
| `operator_wallet_clearing` | asset | debit        | tiền đã trừ từ ví nhà xe, chờ Vexere chuyển về |

Bút toán: `DEBIT <clearing> / CREDIT accounts_receivable`, `externalId = collection_attempt:<id>`. `ApplyInvoicePaymentPayload.clearingAccountCode` chọn tài khoản; mặc định vẫn là `cash`, nên `payInvoice` không đổi hành vi.

## Hệ quả

- **Không có refund về ví.** Credit note `post_payment` trên hoá đơn thu bằng hai method này vẫn đi `outOfBandAmount` / số dư khách; hoàn ngược vào ví hoặc doanh thu vé là việc phía Vexere.
- **Attempt `pending` có thể lệch số dư.** Nếu giữa hai lần dunning hoá đơn được trả tay, lần replay có thể nhận `appliedAmount` lớn hơn phần còn nợ. Pinstripe kẹp về `amountRemaining`; phần dư Vexere đã trừ phải đối soát tay.
- **Subscription chưa từng trả tiền không lên `unpaid`.** Giống thẻ: `SUBSCRIPTION_TRANSITIONS` không cho `incomplete → unpaid`; hết lượt thì hoá đơn `uncollectible` còn subscription ở `incomplete` chờ hết hạn thành `incomplete_expired`.

## Cân nhắc đã bỏ

- **Dùng `customers.balance` làm ví.** Đó là credit trừ vào `amountDue` lúc finalize, không phải nguồn tiền được trừ lúc thu, và số dư thật nằm ở Vexere.
- **Không trừ gì khi không đủ tiền.** Nhà xe có doanh thu vé nhỏ giọt thì hoá đơn sẽ không bao giờ được cấn trừ; BRD muốn "cấn trừ nợ vào kỳ tới".
- **Mô hình hoá ví và doanh thu vé trong pinstripe.** Hai con số đó đã có chủ ở Vexere; giữ bản thứ hai là tạo ra một bản sẽ lệch.
