# ADR 0011 — Dunning & outbound webhooks (Phase 8)

Ngày: 2026-09-16
Trạng thái: Accepted

## Bối cảnh

Hai thứ còn treo từ các phase trước, và cả hai đều là "hệ thống tự làm khi không có ai ngồi đó":

- **Dunning.** `uncollectible` có trong state machine hóa đơn từ phase 6 nhưng **chưa ai chuyển sang
  nó**. Một hóa đơn `open` mà khách không trả thì cứ `open` mãi.
- **Webhook gửi ra ngoài.** `WEBHOOK_SIGNING_SECRET` nằm trong env từ phase 0, queue `WebhookQueue`
  có tên từ phase 0, và chưa dòng nào dùng.

## Quyết định

1. **Webhook đi ra bằng chính đường outbox đã có.** `DomainEventDispatchProcessor` vốn nhận mọi
   domain event — fan-out webhook móc vào đó, không dựng đường riêng. Sự kiện chỉ tới được webhook
   sau khi đã commit vào outbox, nên không có chuyện bắn webhook cho một thứ chưa xảy ra.

2. **Ký HMAC-SHA256 trên `timestamp.payload`, header `pinstripe-signature: t=…,v1=…`.** Timestamp
   nằm **trong** phần được ký, nên đổi timestamp là hỏng chữ ký — đó là cái chặn replay. So sánh
   bằng `timingSafeEqual`, không phải `===`.

3. **Secret trả về đúng một lần, lúc tạo.** Mọi lần đọc sau đó `secret` là `null`. Mất thì tạo
   endpoint mới, không có đường xem lại — vì một secret đọc lại được nhiều lần thì nó chỉ là một
   trường dữ liệu, không phải bí mật.

4. **Idempotency là việc của bên nhận, và ta phải cho họ phương tiện.** Payload mang `id` là **event
   id**, và nó **không đổi qua các lần retry**. Bên nhận lưu id đã xử lý là đủ chặn trùng. Đây là
   điều duy nhất ta có thể làm — retry qua mạng thì không bao giờ "đúng một lần".

5. **Retry để BullMQ lo, bản ghi delivery để kể lại.** `attempts` + `backoff: exponential` là của
   queue; `webhook_deliveries` giữ số lần thử, HTTP status và lỗi gần nhất. Một endpoint chết vì thế
   nhìn thấy được trên màn hình thay vì phải đi đọc log.

   **Một lỗi đã suýt lọt ở đây:** bản đầu tôi ghi nhận thất bại rồi _không_ ném lại khi endpoint trả
   HTTP 500 — BullMQ coi như job xong và **không retry**. Chỉ lỗi mạng mới được retry, còn 500 thì
   im lặng bỏ qua. Đã sửa: mọi kết quả không thành công đều ném `WebhookDeliveryFailedError`.

6. **Dunning là lịch retry, không phải một cron "quét hóa đơn quá hạn".** Finalize đặt
   `dueAt = now + INVOICE_DUE_DAYS` và `nextAttemptAt = dueAt`. Mỗi lần thu hỏng thì `attemptCount++`
   và `nextAttemptAt` nhảy theo `DUNNING_RETRY_DELAY_DAYS` (mặc định `1,3,5,7`). Hết lịch thì
   `uncollectible`.

   `nextAttemptAt` là **cái duy nhất** quyết định hóa đơn có bị chạm tới hay không. Thu được thì nó
   thành `null` và hóa đơn ra khỏi tầm quét — không cần trạng thái "đang dunning" riêng.

7. **Dunning dùng payment method của khách, không hardcode.** Đọc từ
   `customer.metadata.defaultPaymentMethod`, mặc định `pm_card_ok`. Ban đầu tôi hardcode `pm_card_ok`
   và nhận ra ngay: **dunning không bao giờ hỏng được, nên nhánh retry và nhánh bỏ cuộc không test
   được**. Một lịch retry chưa từng chạy khi thanh toán hỏng thì không phải một lịch retry.

8. **Dunning và billing run chia shard giống nhau** (`hashtext(id) % shardCount` + jitter), vì cùng
   một vấn đề: cuối tháng mọi hóa đơn đến hạn một lúc.

## Lỗi thật phát hiện được, và nó đến từ đâu

**Hóa đơn được credit note phủ hết vẫn ở trạng thái `open`, và dunning đi thu 0 đồng.**

Sổ cái từ chối bút toán zero (`Ledger transaction must move a non zero amount`), nên nó nổ chứ không
âm thầm. Nhưng nó chỉ nổ **khi chạy cả bộ test cùng lúc** — chạy riêng file dunning thì không có hóa
đơn nào như vậy trong DB. Chạy từng file một sẽ không bao giờ thấy.

Gốc rễ là ở phase 6: `payInvoice` đánh dấu `paid`, nhưng credit note phủ hết thì không ai đánh dấu
gì. Đã sửa ở ba lớp:

- `CreditNoteService` đóng hóa đơn (`paid`, `amountPaid = 0`, `nextAttemptAt = null`) khi credit note
  phủ hết phần còn nợ;
- `PaymentService.createPaymentIntent` từ chối 409 khi không còn gì để trả;
- `DunningService` bỏ qua và dọn `nextAttemptAt` cho hóa đơn không còn nợ, để một hóa đơn lỡ rơi vào
  trạng thái đó không làm chết cả shard.

## Không làm trong phase này

- **Webhook đi vào (callback của PSP thật).** ADR 0010 §Hạn chế nói rõ `confirmPaymentIntent` hiện
  giả định đồng bộ. Hạ tầng ký và verify đã có (`isWebhookSignatureValid` dùng được cho cả hai
  chiều), nhưng route `/api/v1/system/*` cho PSP gọi vào thì gắn cùng lúc với PSP thật, không sớm hơn.
- **Notification** (email nhắc nợ). `NotificationQueue` vẫn là một cái tên chưa dùng. Dunning hiện
  chỉ thử thu lại chứ không báo cho khách.
- **Dead-letter queue.** Delivery hết lượt thử thì nằm ở `failed` và dừng; chưa có đường phát lại
  bằng tay.

## Kiểm chứng

- 10 unit test cho chữ ký: đúng/sai payload, sai secret, timestamp bị đổi, header rỗng/thiếu vế/không
  phải hex.
- 13 integration test cho dunning và webhook, trong đó có **cả thang retry đầy đủ**: chưa tới hạn thì
  không đụng → thu được thì ngừng đuổi → thẻ hỏng thì hẹn lại → hết lịch thì `uncollectible` → đã bỏ
  cuộc rồi thì không quét nữa.
- Tổng 95 integration test + 58 unit test xanh.
- **Qua HTTP thật, với một receiver độc lập tự verify chữ ký:** endpoint ép trả 500 lần đầu →
  worker retry → lần hai trả 200. Bản ghi: `succeeded`, `attempt_count = 2`, `response_status = 200`.
  Receiver thấy **cùng một event id ở cả hai lần** (`repeat=true`) — đúng hợp đồng idempotency.
- Worker dunning chạy thật: 4 shard, jitter, 0 job fail.
- Một quan sát thật từ đợt chạy: khi relay đẩy toàn bộ tồn đọng lịch sử (~16k event) vào một receiver
  một luồng, delivery fail hàng loạt với `TypeError: fetch failed` và dừng đúng ở
  `WEBHOOK_MAX_ATTEMPTS`. Đó là receiver quá tải chứ không phải lỗi phía gửi — nhưng nó cho thấy
  **chưa có rate limit theo endpoint**, và đó là thứ phải thêm trước khi chạy thật.
