# ADR 0007 — Metering (Phase 4)

Ngày: 2026-09-16
Trạng thái: Accepted

## Bối cảnh

RESEARCH.md §1 tách metering khỏi rating khỏi invoicing, và cảnh báo hai thứ: **dedup** theo
idempotency key trong một cửa sổ thời gian, và **late/out-of-order event**. Phase 4 dựng đường ống
nhận usage; rating (phase 5) và invoicing (phase 6) sẽ đọc từ đây.

## Quyết định

1. **Raw event append-only, không có counter cộng sẵn.** `meter_events` dùng lại trigger
   `ledger_reject_mutation()` của phase 2 — UPDATE/DELETE bị chặn ở tầng DB. Tổng hợp tính **lúc
   đọc** bằng một câu SQL aggregate; không có bảng summary nào để lệch với raw.
   Đây là điều kiện để backfill và repricing lịch sử về sau (Metronome/Orb làm y hệt). Khi khối
   lượng tăng, materialize câu aggregate đó thành view/bảng snapshot — consumer không phải đổi vì
   đã đi qua `getMeterEventSummary`.
2. **Dedup: DB là nguồn sự thật, Redis là bộ lọc nhanh — và đúng thứ tự đó.**
   `meter_events` có unique index `(meter_id, identifier)`; ingest dùng
   `INSERT … ON CONFLICT DO NOTHING RETURNING id`, nên số id trả về **chính là** số event được nhận.
   Redis chỉ được ghi **sau khi** insert thành công.
   Thứ tự này quan trọng: nếu claim Redis trước rồi mới ghi DB, một lần crash giữa hai bước sẽ khoá
   identifier đó suốt 35 ngày và event **mất hẳn**. Với thứ tự hiện tại, crash chỉ làm mất bộ lọc
   nhanh — lần sau event vẫn tới DB và vẫn được nhận diện đúng.
3. **Cửa sổ dedup 35 ngày là một ràng buộc, không phải gợi ý.** Event có `timestamp` cũ hơn
   `METER_DEDUP_WINDOW_DAYS` bị từ chối 400: quá cửa sổ thì hệ thống không còn khẳng định được nó đã
   được nhận hay chưa, và im lặng chấp nhận là cách tính trùng tiền của khách.
4. **Hai trục thời gian, và watermark là `receivedAt`.** Mỗi event có `timestamp` (lúc việc xảy ra)
   và `receivedAt` (lúc hệ thống biết). `getMeterEventSummary` lọc theo `timestamp` cho cửa sổ, và
   nhận thêm `receivedBefore` / `receivedAfter`:
   - kỳ đã chốt hỏi với `receivedBefore = thời điểm chốt` → số của kỳ đó **không bao giờ đổi**;
   - kỳ sau hỏi với `receivedAfter = thời điểm chốt kỳ trước` → event về trễ rơi vào kỳ sau.

   **Hệ quả cho kế toán:** usage về sau khi hóa đơn đã phát hành **không sửa hóa đơn cũ** — nó thành
   dòng bù ở kỳ kế tiếp. Đây là quy tắc phải nói với team kế toán trước khi chạy thật.

5. **Ingest trả 202, không phải 201.** Nhận và ghi xong thì trả ngay; tổng hợp là việc của lúc đọc.
   Batch tối đa 1000 event/lần và trả `{ accepted, duplicates }` để caller tự đối soát.
6. **Một meter một `event_name`** (unique index). `resolveMeter(eventName)` là điểm vào duy nhất —
   event không khớp meter nào đang active thì bị từ chối 404 thay vì ghi vào hư không.
7. **`count` bỏ qua `valueKey`.** Các aggregation còn lại đọc giá trị từ `payload[valueKey]`; thiếu
   khóa đó thì 400 với tên khóa trong message, không âm thầm tính 0.

## Không làm trong phase này

Plan có nhắc một aggregation job chạy nền. Không dựng: tổng hợp lúc đọc đã đúng và đủ nhanh
(100.000 event, tổng hợp dưới 100ms), còn một job pre-compute sẽ tạo đúng thứ ADR này vừa tránh —
một con số sống song song với raw và có thể lệch. Dựng khi phép đo nói cần.

## Kiểm chứng

- 100.000 event qua đường batch, 10% trùng identifier: **7.4 giây**, đúng 9.999 bản trùng bị loại,
  `eventCount` và `value` khớp chính xác số đã nhận.
- Event về trễ sau mốc chốt: kỳ đã chốt giữ nguyên 40, kỳ sau nhận đúng 60.
- `UPDATE meter_events` bị DB từ chối.
- Qua HTTP thật: 3 event lẻ (2 trùng) + batch 5 event (2 trùng) → tổng đúng 5 event, 500 tokens.
