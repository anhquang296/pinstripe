# ADR 0010 — Payment orchestration & refund (Phase 7)

Ngày: 2026-09-16
Trạng thái: Accepted

## Bối cảnh

Phase 6 dựng được hóa đơn nhưng thu tiền thì chỉ là một câu `payInvoice` gọi tay — không có PSP,
không có lần thử nào được ghi lại, và **không có đường trả lại tiền đã thu**. Credit note của phase 6
cố tình chỉ xóa được phần khách **chưa trả**, với lời hứa rằng refund là việc của phase này.

RESEARCH.md chốt PSP Việt Nam (VNPay, MoMo, ZaloPay) là thứ **mua chứ không xây**. Nên việc của
phase 7 không phải là tích hợp một cổng cụ thể, mà là **dựng cái khuôn** để cổng thật lắp vào sau
mà không phải sửa tầng nghiệp vụ.

## Quyết định

1. **PSP là một client, không phải một service.** `MockPspClient` nhận `(config, logger)`, không đọc
   env, không biết Fastify, không import error HTTP của app — nó ném error class của chính nó và
   tầng trên map sang mã trạng thái. Đây là hình dạng mà một client VNPay sau này phải khớp vào; đổi
   PSP là đổi một dòng trong `psp.plugin.ts`.

2. **PSP giả lập phải hỏng được, nếu không thì test vô nghĩa.** Kết quả do **token thẻ** quyết định,
   tất định:
   - `pm_card_ok` → duyệt
   - `pm_card_declined` → `card_declined`
   - `pm_card_insufficient_funds` → `insufficient_funds`
   - `pm_card_error` → `processing_error`

   Một PSP giả lập lúc nào cũng duyệt chỉ chứng minh được đúng nhánh dễ, trong khi nhánh khó mới là
   nhánh làm mất tiền.

3. **Mọi lần thử đều được giữ lại.** `payment_attempts` là append-only (dùng lại trigger của sổ cái).
   Thẻ bị từ chối rồi thử lại thẻ khác thì cả hai lần đều nằm đó. Một hệ thống thanh toán không trả
   lời được câu "tại sao lần đầu hỏng" là một hệ thống không đối soát được.

4. **Payment intent là một state machine, và `succeeded` là trạng thái cuối.** Bị từ chối thì intent
   quay về `requires_payment_method` để thử lại thẻ khác — không tạo intent mới, vì như vậy sẽ mất
   lịch sử các lần thử. Confirm một intent đã thành công thì bị chặn 409.

5. **Thu tiền không đi thẳng vào hóa đơn.** `confirmPaymentIntent` thành công mới gọi
   `invoiceService.payInvoice`. Nghĩa là `payInvoice` giờ là thao tác **nội bộ**, không còn là cửa
   cho người dùng — và admin UI đã được đấu lại cho đúng: nút "Thu tiền" tạo intent rồi confirm,
   không gọi tắt. Một cửa hậu bỏ qua PSP là thứ sẽ được dùng rồi thành thói quen.

6. **Refund ghi giảm doanh thu, không đụng phải thu.** Bút toán: `DR doanh thu / CR cash`.

   Đây là chỗ dễ nhầm với credit note. Hai thứ trả lời hai câu khác nhau:
   - **Credit note** — khách _chưa trả_, ta xóa nợ → `DR doanh thu / CR phải thu`.
   - **Refund** — khách _đã trả_, ta trả lại → `DR doanh thu / CR cash`.

   Phải thu sau khi thanh toán đã về 0; refund không được đụng vào nó, nếu không số dư sẽ âm — đúng
   cái bẫy phase 6 đã rơi vào một lần.

7. **Refund bị chặn theo số tiền mà chính payment intent đó đã thu**, không theo tổng hóa đơn. Một
   hóa đơn trả làm hai lần thì mỗi lần hoàn theo lần thu tương ứng — vì PSP cũng hoàn theo từng
   charge, không theo hóa đơn.

8. **`amountRefunded` tính lúc đọc.** Cộng từ bảng `refunds`, batch theo trang, giống
   `amountCredited` của phase 6. Không thêm cột counter.

## Không làm trong phase này

- **PSP thật.** Khuôn đã có; lắp VNPay là việc của một phase riêng, và nó sẽ kéo theo tokenization
  để giảm phạm vi PCI-DSS.
- **Payment method lưu trữ.** Token thẻ hiện là một chuỗi đi thẳng vào PSP giả lập. Lưu thẻ là việc
  của cổng thật, không phải của ta.
- **Partial capture / authorize rồi capture sau.** Mock hiện thu ngay khi confirm.

## Hạn chế đã biết — và nó quan trọng

**PSP giả lập trả lời đồng bộ. PSP thật thì không.** VNPay/MoMo trả kết quả qua callback, có thể
đến sau vài giây hoặc vài phút, có thể đến hai lần, và có thể đến trước cả khi request gốc trả về.
Toàn bộ `confirmPaymentIntent` hiện viết theo giả định đồng bộ.

Chỗ sửa khi lắp cổng thật đã biết trước: `confirm` chỉ đẩy intent sang `processing` rồi trả về; một
**webhook handler idempotent** mới là chỗ chuyển sang `succeeded` và gọi `payInvoice`. Hạ tầng cho
việc đó — queue `PaymentQueue`, `WEBHOOK_SIGNING_SECRET` — đã có sẵn từ phase 0 nhưng chưa dùng, và
phase 8 là nơi nó được dùng.

Nói thẳng: đây **không phải** thiết kế đúng cho production, mà là thiết kế đủ để chứng minh vòng đời
và để tầng nghiệp vụ không phải viết lại khi cổng thật vào.

## Kiểm chứng

- 12 integration test: intent mặc định theo số còn nợ, chặn intent vượt số nợ, chặn thu trên hóa đơn
  không `open`, thu thành công đẩy hóa đơn sang `paid` và phải thu về 0, **thẻ bị từ chối để hóa đơn
  nguyên vẹn và phải thu không đổi**, cả hai lần thử đều còn trên bản ghi, confirm lại bị chặn,
  refund giảm doanh thu chứ không đụng phải thu, refund toàn bộ khi không truyền số tiền, chặn hoàn
  quá số đã thu, chặn hoàn một intent chưa thu được đồng nào, và một test đánh thẳng DB xác nhận
  `refunds` append-only.
- Toàn bộ 81 integration test xanh.
- **Đối chiếu độc lập trên DB thật**: tổng `refunds.amount` = **2.702.000**, tổng ghi có tài khoản
  `cash` = **2.702.000**. Số bút toán lệch khỏi zero-sum trên toàn hệ thống: **0**.
- Qua HTTP thật: intent 500.000 → thẻ từ chối (`card_declined`, hóa đơn vẫn `open`, phải thu vẫn
  500.000) → thử lại thẻ tốt (`succeeded`, hóa đơn `paid`, phải thu 0, hai lần thử đều còn) →
  confirm lại bị chặn 409 → hoàn 200.000 → hoàn thêm 400.000 bị chặn với thông báo còn đúng 300.000.
- Trên admin UI: nút "Thẻ bị từ chối" hiện đúng thông báo của PSP và không đổi hóa đơn; "Thu tiền"
  đẩy sang `paid`; "Hoàn tiền" trên trang Payments chạy đúng.
