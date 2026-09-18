# 0023 — Thu tiền qua nền tảng đối tác: `offset_ticket` và `debit_wallet`

- **Trạng thái.** Accepted
- **Xây trên.** [0014 — Mô hình tổng hoá đơn](0014-invoice-totals-model.md), [0020 — Dòng tiền](0020-money-flow.md)

## Bối cảnh

BRD SaaS Billing (`docs/brd/`) nói kênh thu chính của Vexere không phải thẻ mà là **cấn trừ tiền bán vé** và **trừ ví nhà xe**. Đến trước quyết định này pinstripe chỉ có hai collection method: `charge_automatically` (dunning quẹt thẻ qua PSP) và `send_invoice` (không tự thu). Doanh thu bán vé và số dư ví nằm ở hệ thống của đối tác, không ở pinstripe.

Vexere là đối tác đầu tiên, không phải duy nhất: platform sẽ phục vụ thêm các SaaS khác theo cùng mô hình. Vì vậy mọi tên trong code nói **partner**, không nói Vexere hay nhà xe. Chỉ `VexereClient` / `MockVexereClient` mang tên Vexere, vì một client được đặt theo hệ thống nó bọc.

## Quyết định

### 1. Hai giá trị mới trong `CollectionMethodEnum`

`offset_ticket` và `debit_wallet`. Cột `collection_method` là `text` không CHECK nên không cần DDL. Cả hai được coi là **thu tự động**: finalize đặt `nextAttemptAt = dueAt` giống `charge_automatically` (`AUTOMATIC_COLLECTION_METHODS` ở `constants/collection.ts`).

Chưa có collection timing (đầu kỳ / cuối kỳ / ngày trong kỳ / trước đầu kỳ). Hai method mới đi đúng đồng hồ `nextAttemptAt` hiện có.

### 2. Customer mang `partnerPlatform` + `partnerAccountId`

- `partnerPlatform` (`PartnerPlatformEnum`, hiện có `vexere`) cho biết mã thuộc hệ thống nào.
- `partnerAccountId` là mã tài khoản của customer ở hệ thống đó.

Cả hai nullable, vì khách không thu qua đối tác thật sự không có tài khoản ở đó. Hai field luôn đi cùng nhau: CHECK `customers_partner_pair` ở DB và `400` ở service nếu chỉ gửi một field. Partial unique index `(partner_platform, partner_account_id)` giữ cho một tài khoản đối tác không bị gắn vào hai customer (`409`).

Tạo hoặc đổi subscription / invoice sang method mới khi customer chưa có tài khoản đối tác → `400` (`assertCollectionMethodUsable`).

Migration `0029` đặt tên cột là `vexere_operator_id`; `0030` đổi tên thành `partner_account_id`, thêm `partner_platform` và backfill `vexere` cho những hàng đã có mã.

### 3. `PartnerCollectionProvider` theo từng platform

Interface ở `types/partner-collection-provider.ts`, hai method `offsetTicketSales` / `debitWallet`, trả `{ appliedAmount, reference }`. `appliedAmount` nằm trong `0…amount`: **trừ được một phần là kết quả hợp lệ**, không phải lỗi.

`partner-collection.plugin.ts` decorate `partnerCollectionProviders: Record<PartnerPlatform, PartnerCollectionProvider>`, và `PartnerCollectionService` chọn provider theo `customer.partnerPlatform`. Thêm một đối tác nghĩa là thêm một member enum, một client và một entry; `Record` bắt đủ mọi platform lúc compile.

Với Vexere, plugin dùng `VexereClient` (HTTP, `VEXERE_API_URL` / `VEXERE_API_KEY` / `VEXERE_TIMEOUT_MS`) khi đủ cấu hình, ngược lại `MockVexereClient`. Client tự dịch `partnerAccountId` sang từ vựng của Vexere (`operatorId`). Path và hình dạng body của `VexereClient` là **tạm** vì phía Vexere chưa có spec; khi chốt spec thì chỉ sửa file client.

### 4. `collection_attempts` giữ idempotency qua ranh giới hệ thống

Gọi hệ thống ngoài rồi mới commit DB nên có thể crash giữa chừng. Mỗi lần thu là một hàng `pending`, **commit trước** khi gọi đối tác, với `idempotencyKey = collection_attempts.id`. Lần dunning sau thấy hàng `pending` thì gọi lại **cùng key**, và đối tác trả lại kết quả cũ thay vì trừ lần hai.

- Lỗi từ provider → attempt `failed` + `failure_message`.
- Lỗi DB sau khi đối tác đã trừ tiền → attempt vẫn `pending`, và dunning thử lại với cùng key.

### 5. Trả một phần, còn lại nợ

`settleInvoice` vốn đã nhận `amount < owed`, nên tiền trừ được ghi vào `amountPaid` và hoá đơn giữ `open`. Sau đó `DunningService.collectFromPartner` đi đúng nhánh retry của thẻ không có payment method (`scheduleRetryOrAbandon`):

- `attemptCount += 1`, hẹn lần sau theo `DUNNING_RETRY_DELAY_DAYS`;
- subscription → `past_due` / `incomplete`;
- hết lượt → hoá đơn `uncollectible`.

Lần retry chỉ đòi `amountRemaining`.

Trả đủ → `handleInvoicePaymentSucceeded` đưa subscription về `active` và tiến `chargedThroughDate`.

### 6. Hai tài khoản clearing trong sổ cái

| Mã                        | Loại  | Số dư thường | Ý nghĩa                                            |
| ------------------------- | ----- | ------------ | -------------------------------------------------- |
| `ticket_offset_clearing`  | asset | debit        | tiền sẽ nhận về qua đối soát doanh thu bán vé      |
| `partner_wallet_clearing` | asset | debit        | tiền đã trừ từ ví ở đối tác, chờ đối tác chuyển về |

Bút toán: `DEBIT <clearing> / CREDIT accounts_receivable`, với `externalId = collection_attempt:<id>`. `ApplyInvoicePaymentPayload.clearingAccountCode` chọn tài khoản; mặc định vẫn là `cash`, nên `payInvoice` không đổi hành vi. Migration `0030` đổi mã `operator_wallet_clearing` cũ trong `ledger_accounts`.

## Hệ quả

- **Không có refund về ví.** Credit note `post_payment` trên hoá đơn thu bằng hai method này vẫn đi `outOfBandAmount` / số dư khách. Hoàn ngược vào ví hoặc doanh thu vé là việc phía đối tác.
- **Attempt `pending` có thể lệch số dư.** Nếu hoá đơn được trả tay giữa hai lần dunning, lần replay có thể nhận `appliedAmount` lớn hơn phần còn nợ. Pinstripe kẹp về `amountRemaining`; phần dư đối tác đã trừ phải đối soát tay.
- **Subscription chưa từng trả tiền không lên `unpaid`.** Giống thẻ: `SUBSCRIPTION_TRANSITIONS` không cho `incomplete → unpaid`. Hết lượt thì hoá đơn `uncollectible`, còn subscription ở `incomplete` chờ hết hạn thành `incomplete_expired`.
- **Mỗi customer gắn được một đối tác.** Nếu một khách cần tài khoản ở hai nền tảng cùng lúc, cặp cột này phải tách thành bảng riêng.

## Cân nhắc đã bỏ

- **Dùng `customers.balance` làm ví.** Đó là credit trừ vào `amountDue` lúc finalize, không phải nguồn tiền được trừ lúc thu, và số dư thật nằm ở đối tác.
- **Không trừ gì khi không đủ tiền.** Nhà xe có doanh thu vé nhỏ giọt thì hoá đơn sẽ không bao giờ được cấn trừ, trong khi BRD muốn "cấn trừ nợ vào kỳ tới".
- **Mô hình hoá ví và doanh thu vé trong pinstripe.** Hai con số đó đã có chủ ở đối tác; giữ bản thứ hai là tạo ra một bản sẽ lệch.
- **`vexereOperatorId` / `externalId`.** Cái đầu gắn chặt vào một đối tác. Cái sau quá chung, và `ledger_transactions.external_id` đã mang nghĩa idempotency key.
