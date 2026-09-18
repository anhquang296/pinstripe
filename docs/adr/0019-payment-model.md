# 0019 — Mô hình payment

- **Trạng thái.** Accepted
- **Phase.** 18 — Mô hình payment
- **Thay thế một phần.** [0010 — Phase 7 payments](0010-phase-7-payments.md)

## Bối cảnh

Trước phase này, "phía thanh toán" là một chuỗi string. `customers.default_payment_method`,
`subscriptions.default_payment_method` và `payment_intents.payment_method` đều là `text` tự do; mock
PSP quyết định approve hay decline bằng cách so tên chuỗi đó (`pm_card_declined`). Không có object
nào mô tả một thẻ, không có nơi nào lưu `last4`, và không có khoá ngoại nào ngăn một subscription
trỏ vào một phương thức đã bị xoá.

`confirmPaymentIntent` giả định PSP trả lời đồng bộ: nó gọi `createCharge`, ghi intent `succeeded`
trong transaction 1, rồi gọi `payInvoice` trong transaction 2. Chết giữa hai transaction là đã thu
tiền mà hoá đơn chưa ghi nhận — khe hở được ghi ở [PITFALLS §4](../PITFALLS.md#4-trạng-thái-kẹt-không-tự-thoát).

Dunning thì retry theo một lịch cố định (`DUNNING_RETRY_DELAY_DAYS`), không phân biệt "thẻ hết tiền
hôm nay" với "thẻ bị báo mất" — thử lại một hard decline là vừa vô ích vừa đẩy tỷ lệ decline của
merchant lên.

`NotificationQueue` tồn tại như một cái tên trong `QueueNameEnum` và không có gì phía sau.

## Quyết định

### 1. Confirm là bất đồng bộ

`confirmPaymentIntent` **không** còn trả về `succeeded`. Nó gọi PSP, nhận `processing` hoặc
`requires_action`, ghi `pspReference` rồi trả về. Tiền vào là một **callback** riêng.

Mọi hệ quả của một lần thu tiền — tạo `charges`, chuyển intent sang `succeeded`, ghi
`invoice_payments`, bút toán cash receipt, phát event — nằm trong **đúng một transaction** ở
`PaymentService.applyPaymentSuccess`. Khe hở hai transaction của PITFALLS §4 vì thế không còn:
chết giữa đường nghĩa là transaction rollback, và PSP gửi lại callback.

Callback được idempotent hai lớp:

- `psp_events(provider, event_id)` unique — gửi trùng cùng `eventId` bị bỏ qua, API trả
  `isDuplicate: true`.
- `invoice_payments(livemode, settlement_reference)` unique với `settlement_reference =
payment_intent:<id>` — một intent chỉ áp được vào hoá đơn một lần, kể cả khi PSP đổi `eventId`.

Lớp thứ ba là `SELECT … FOR UPDATE` trên intent cộng với việc bỏ qua callback đến sau khi intent đã
`succeeded`.

Cái giá của quyết định này: `DunningService.collectInvoice` không còn biết ngay kết quả. Nó đặt
`nextAttemptAt = now + DUNNING_IN_FLIGHT_TIMEOUT_MS` và trả về `attempted`; reaper của phase 10 là
thứ cứu một callback không bao giờ đến. Việc lên lịch thử lại chuyển sang
`DunningService.handlePaymentFailed`, gọi từ đường callback.

### 2. Dữ liệu thẻ: chỉ token, không bao giờ số thẻ

`payment_methods` lưu `psp_token` cộng với metadata PSP trả về (`brand`, `last4`, `expMonth`,
`expYear`, `fingerprint`, `funding`, `country`). Không có cột nào chứa PAN, CVC hay track data, và
không có đường nào để một số thẻ đi vào hệ thống: `createPaymentMethod` chỉ nhận `token`.

Hệ quả là `MockPspClient` phân biệt hành vi theo **token** (`tok_visa_ok`, `tok_visa_3ds`,
`tok_card_lost`…) chứ không theo id của payment method. `PspTokenEnum` là danh sách token test đóng.

### 3. Mọi cột `paymentMethod text` thành khoá ngoại

| Cột cũ                                 | Cột mới                                        |
| -------------------------------------- | ---------------------------------------------- |
| `customers.default_payment_method`     | `customers.default_payment_method_id` → FK     |
| `subscriptions.default_payment_method` | `subscriptions.default_payment_method_id` → FK |
| `payment_intents.payment_method`       | `payment_intents.payment_method_id` → FK       |

Migration `0024_payment_model` **drop rồi add** thay vì rename: giá trị cũ (`pm_card_ok`) không phải
id của bản ghi nào, nên không có cách nào giữ lại chúng dưới khoá ngoại mới.

`customers` ↔ `payment_methods` là một cặp FK vòng. Cả hai chiều đều nullable và cả hai
`references()` đều là callback lười, nên thứ tự khởi tạo module không vỡ; `customers.schema.ts` cần
annotation `AnyPgColumn` cho chiều của nó.

Detach xoá mọi chỗ trỏ tới: `customers.default_payment_method_id` và
`subscriptions.default_payment_method_id` được set null trong cùng transaction, và
`getChargeablePaymentMethod` từ chối một payment method đã detach.

### 4. `payment_attempts` gộp vào `charges`

`charges` là object thật: `amount`, `amount_captured`, `amount_refunded`, `captured`, `status`,
`outcome`, `balance_transaction_id`, `payment_method_details`, `failure_code`, `decline_code`.
Mỗi lần thử là một dòng charge, nên nhật ký thử mà `payment_attempts` từng giữ vẫn còn — cùng một
bảng, nhiều cột hơn.

`payment_attempts` bị drop cùng trigger append-only của nó. `charges` **không** append-only: capture
và refund đổi `captured` / `amount_captured` / `amount_refunded` trên chính dòng đó.
`balance_transaction_id` để rỗng ở phase này; phase 19 mới có `balance_transactions`.

### 5. PaymentIntent đủ trạng thái

`processing`, `requires_action` (kèm `next_action` cho 3DS/SCA), `requires_capture` (tách auth và
capture qua `capture_method` + `POST /v1/payment_intents/:id/capture`), `cancellation_reason` khi
`canceled`. Và intent **độc lập**: `invoice_id` nullable đã có từ phase 13, giờ
`createPaymentIntent` nhận `customerId` + `amount` + `currency` thay cho `invoiceId`.

Capture cũng bất đồng bộ, cùng lý do như confirm: nó gửi lệnh rồi chờ callback `payment.succeeded`.

### 6. Callback dưới `/api/v1/system/*` không dùng API key

`POST /api/v1/system/psp/:provider/callbacks` là **ngoại lệ được liệt kê** của
[route-convention](../../.claude/rules/agentkit/profiles/fastify/route-convention.md): nó không đi
qua `verifySystemRequest`, vì PSP không giữ API key của chúng ta. Credential của nó là chữ ký HMAC.

`systemRoutes` vì thế đăng ký hai scope: `pspCallbacksRoutes` với hook riêng
`verifyPspCallbackRequest`, và một scope trong đó mọi route khác (`/ping`) mang
`verifySystemRequest`. Không route nào không có hook.

`verifyPspCallbackRequest` cần raw body để tính HMAC, nên scope callback tự khai một
`addContentTypeParser('application/json', { parseAs: 'string' })` giữ `request.rawBody`. Parser đó
chỉ sống trong scope ấy.

Chữ ký có **tolerance**: `isWebhookSignatureValid` trong core nhận thêm
`{ toleranceSeconds, verifiedAt }`, và callback dùng `PSP_CALLBACK_TOLERANCE_SECONDS` (mặc định 300).
Không có `PSP_WEBHOOK_SECRET` thì route trả 500 chứ không nhận bừa.

### 7. Smart retry thay lịch cố định

`DECLINE_TAXONOMY` map mỗi `DeclineCode` sang `{ kind, retryDelayDays }`. `mapPspDeclineCode` đưa mã
thô của PSP về taxonomy đó, với `generic_decline` làm fallback cho mã chưa từng thấy.

- **Hard** (`lost_card`, `stolen_card`, `fraudulent`, `pickup_card`, `invalid_account`,
  `currency_not_supported`) → `retryDelayDays` rỗng, `resolveRetryDelayDays` trả `null`, dunning
  abandon ngay ở lần decline đầu tiên. Không thử lại, một lần cũng không.
- **Soft** → lịch riêng theo mã: `insufficient_funds` là `[3, 5, 7]` (đợi lương), `try_again_later`
  là `[1, 1, 3]` (lỗi tạm), `expired_card` là `[7]` (một lần duy nhất, cho khách kịp đổi thẻ).

`DUNNING_RETRY_DELAY_DAYS` vẫn còn, nhưng chỉ còn là fallback cho trường hợp **không có** decline
code — ví dụ chu kỳ không có payment method nào để thử.

`attemptCount` là số lần thất bại; lịch được đọc ở `schedule[attemptCount - 1]`; hết lịch là
abandon.

### 8. NotificationQueue được cài đặt thật

`smtp.client.ts` bọc nodemailer, `(config, logger)`, `static isConfigured` theo
`SMTP_HOST`. `notification.plugin.ts` decorate `mailer: SmtpClient | null` — không có SMTP host thì
`null`, và `NotificationService.sendNotification` trả `skipped_no_mailer` chứ không throw.

Template là `build<X>` thuần trong `utils/notification-template.ts` (subject + text + html). Chuỗi
trong template là tiếng Anh, cùng ngôn ngữ với error message của API.

Job chỉ mang `{ kind, livemode, customerId, invoiceId, paymentIntentId }`; worker đọc lại dữ liệu
tươi thay vì mang một bản chụp trong payload. `jobId` là
`notification:<kind>:<invoiceId|paymentIntentId|customerId>` nên một dispatch lặp không gửi hai lần.

`NotificationWorkflow` trong worker tiêu thụ queue; Mailpit trong `docker/compose.yml` là hộp thư
của dev và của integration test.

## Hệ quả

- **Mock PSP là in-process.** Event mô phỏng nằm trong bộ nhớ của tiến trình đã gọi `confirm`, nên
  `drainProviderEvents()` chỉ thấy event do chính tiến trình đó sinh ra. Trong test một tiến trình,
  điều này là đủ. Trong dev, `PaymentWorkflow` poll simulator **của worker** mỗi
  `PSP_CALLBACK_POLL_INTERVAL_MS`, nên đường dunning chạy trọn vẹn; một confirm gọi từ API thì
  không tự settle — PSP thật ở phase 24 mới xoá được chỗ lệch này.
- **Admin UI mất nút "Thẻ bị từ chối".** Nút đó dựng trên hằng `pm_card_declined`, thứ không còn là
  một payment method hợp lệ. Demo decline cần chọn một payment method thật, và UI chọn thẻ là phase 20.
- **`BillingRunResult.collected` thành `attempted`.** Billing run không còn biết đã thu được hay
  chưa tại thời điểm nó chạy.
- **`DunningOutcome` thêm `attempted` và `awaiting`.** `awaiting` là lúc một confirm trước đó còn
  đang bay và dunning từ chối charge lần hai.

## Cân nhắc đã bỏ

- **Giữ confirm đồng bộ và bọc cả hai bước trong một transaction.** Không làm được: gọi PSP là I/O
  mạng, giữ transaction mở suốt cuộc gọi đó là giữ lock hàng hoá đơn qua độ trễ của bên thứ ba.
- **`payment_attempts` giữ riêng, `charges` là bảng mới.** Hai bảng mô tả cùng một sự việc với hai
  mức chi tiết; mọi đoạn code muốn "lần thử cuối" sẽ phải chọn một trong hai.
- **Retry schedule cấu hình bằng env.** Một chuỗi env không diễn tả được "mã này không thử lại".
  Taxonomy là code, có exhaustiveness check của `Record<DeclineCode, …>`.
