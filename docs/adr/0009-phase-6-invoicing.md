# ADR 0009 — Invoicing & billing run (Phase 6)

Ngày: 2026-09-16
Trạng thái: Accepted

## Bối cảnh

Phase 5 tính ra được số tiền nhưng không giữ lại gì — hỏi hai lần có thể ra hai số. Phase 6 là chỗ
con số đó **được đóng băng**: có số hóa đơn, có thời điểm phát hành, và từ đó không đổi nữa.

RESEARCH.md gọi tên hai rủi ro mà phase này phải trả lời trực tiếp:

- **#1 Billing run cuối tháng (thundering herd)** → shard + jitter + job idempotent.
- **#2 Bất biến & đánh số hóa đơn** → hóa đơn đã phát hành read-only; sửa bằng credit note số riêng;
  _"test đảm bảo không nhảy số"_.

## Quyết định

1. **Số hóa đơn lấy từ bảng đếm, không dùng SEQUENCE.** `number_sequences` là một hàng, cấp số bằng
   `UPDATE … SET next_value = next_value + 1 RETURNING` **trong chính transaction finalize**.

   Lý do là thứ dễ chọn sai: Postgres `SEQUENCE` **không** trả số lại khi transaction rollback — nó
   nhảy số, và đó chính xác là thứ rủi ro #2 cấm. Row lock trên bảng đếm thì có: finalize hỏng, số
   quay về. Đánh đổi là ghi tuần tự trên một hàng, nhưng finalize không phải đường nóng — ingest mới
   là, và ingest không đụng vào đây.

2. **Draft không có số, không có line item.** Draft chỉ là chỗ giữ chỗ cho một kỳ. Line item chỉ
   sinh ra lúc finalize, khi rating được gọi và kết quả được chép xuống. Trước đó không có gì để
   lệch, vì không có gì được lưu.

3. **Bất biến cưỡng chế ở tầng DB, không chỉ ở service.**
   - `invoice_line_items` và `credit_notes` dùng lại trigger `ledger_reject_mutation()` — UPDATE và
     DELETE bị chặn hoàn toàn.
   - `invoices` có trigger riêng: khi `status <> 'draft'`, mọi thay đổi vào `number`, `total`,
     `subtotal`, `currency`, `customer_id`, kỳ, hay `finalized_at` đều bị từ chối. `status`,
     `amount_paid`, `paid_at` vẫn đổi được — vòng đời còn chạy tiếp, chỉ nội dung đã tính tiền là
     đóng.

   Ở tầng service cũng có state machine, nhưng service thì ai cũng viết được một cái mới. Trigger thì
   một câu `UPDATE` tay lúc 2 giờ sáng cũng không qua được.

4. **Sửa sai bằng credit note, có dãy số riêng** (`CN-000001`), và credit note **ghi bút toán đảo**
   vào sổ chứ không sửa hóa đơn.

5. **Credit note chỉ xóa được phần khách còn nợ.** Đây là chỗ tôi làm sai ở lần chạy đầu và phải sửa:
   ban đầu tôi chặn theo `total`, nên một hóa đơn 1.000.000 đã trả 400.000 vẫn nhận được credit note
   900.000 — tài khoản phải thu của khách xuống **âm 400.000**.

   Quy tắc đúng: `creditable = total − amountPaid − alreadyCredited`. Tiền khách **đã trả** muốn trả
   lại thì phải hoàn tiền (refund), không phải credit note — và refund là việc của phase 7. Sổ kép
   bắt được lỗi này ngay: số dư phải thu âm là dấu hiệu không thể bịa.

6. **`amountCredited` tính lúc đọc, không lưu thành cột.** Cộng từ bảng `credit_notes`, batch theo
   trang. Lưu thành counter là đúng thứ ADR 0007 gọi là "balance amnesia" — một con số sống song song
   với raw và có quyền lệch.

7. **Hóa đơn ghi sổ ngay khi phát hành.** Finalize → nợ `accounts_receivable` (theo từng khách) /
   có `revenue`. Thanh toán → nợ `cash` / có phải thu. Hủy → đảo lại bút toán phát hành. Credit note →
   nợ `revenue` / có phải thu. Mọi bút toán mang `externalId` gắn với hóa đơn, nên chạy lại không
   nhân đôi.

8. **Billing run: một job một shard, chia bằng `hashtext(id) % shardCount`.** Scheduler bắn
   `shardCount` job mỗi nhịp, mỗi job có `delay` ngẫu nhiên trong `BILLING_RUN_JITTER_MS` để không
   cùng đập vào DB một lúc. Idempotent nằm ở **unique index `(subscription_id, period_start)`**, không
   nằm ở jobId: chạy lại bao nhiêu lần cũng ra đúng một draft cho một kỳ.

9. **Finalize từ chối hóa đơn của kỳ đã trôi qua.** Nếu subscription đã sang kỳ mới mà draft cũ chưa
   phát hành, rating sẽ tính theo kỳ hiện tại — sai kỳ. Chặn bằng 409 thay vì phát hành một con số
   thuộc về kỳ khác.

## Không làm trong phase này

- **Thuế và hóa đơn điện tử.** RESEARCH.md §"Mua thay vì xây" nói rõ: phần pháp lý của NĐ 123/2020
  (sửa bởi NĐ 70/2025) đi qua nhà cung cấp e-invoice, không tự xây. Dãy số ở đây là dãy **nội bộ**;
  số hóa đơn có mã cơ quan thuế là dãy của nhà cung cấp, và hai thứ đó không được lẫn.
- **Refund.** Credit note xóa nợ; trả lại tiền đã thu là phase 7.
- **Dunning.** `uncollectible` có trong state machine nhưng chưa ai chuyển sang nó — phase 8.
- **PDF.** Chưa cần thiết để chứng minh vòng đời đúng.

## Hạn chế đã biết

- **`payInvoice` chưa gắn với PSP.** Nó ghi nhận một khoản đã thu và đẩy vào sổ; chưa có
  payment intent, chưa có đối soát. Phase 7 sẽ đặt PSP trước nó, không thay nó.
- **Một dãy số cho toàn hệ thống.** Chưa tách theo năm hay theo series. Khi cần, thêm hàng vào
  `number_sequences` — cấu trúc đã chịu được, chỉ là chưa dùng.

## Kiểm chứng

- 19 integration test: draft idempotent, finalize đóng băng + cấp số, **không nhảy số qua 3 lần phát
  hành liên tiếp**, finalize hai lần bị chặn, thanh toán một phần / đủ, trả quá bị chặn, hủy đảo bút
  toán, hủy hóa đơn đã trả bị chặn, credit note vượt số còn nợ bị chặn, thanh toán + credit note cộng
  lại thì hóa đơn đóng, và **hai test đánh thẳng vào DB** xác nhận trigger chặn ghi đè.
- Kiểm tra ngược trên DB thật: `update invoices set total = 1` → bị từ chối;
  `delete from invoice_line_items` → bị từ chối; `update … set updated_at = now()` → vẫn cho.
- Worker billing chạy thật với 4 shard: 37 subscription chia thành 11/10/9/7 không trùng, jitter giãn
  các shard ~400ms, 0 job fail.
- Qua HTTP thật: draft → finalize (`INV-000049`, 1.000.000) → trả 400.000 → credit note `CN-000010`
  100.000 → credit 900.000 bị từ chối → phải thu còn đúng **500.000**, khớp `amountRemaining`.
