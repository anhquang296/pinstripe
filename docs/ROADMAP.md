# Roadmap

Kế hoạch triển khai pinstripe — bản clone Stripe dựng để **nhìn thấy cách một billing system vận
hành** trước khi bàn chuyện customize cho team kế toán. Mỗi phase xong thì có một ADR ghi lại quyết
định và đánh đổi; bảng này là chỗ duy nhất nhìn được toàn cảnh.

Nền tảng chung: `docs/RESEARCH.md` (phân tích domain + 8 rủi ro kiến trúc). Quy ước code:
`.claude/rules/`. Cách chạy: `docs/DEVELOPMENT.md`.

## Quyết định khung (đã chốt, không mở lại trừ khi có lý do mới)

| Vấn đề     | Chốt                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Bề mặt API | Bám sát Stripe, nhưng **camelCase trên wire** (lệch có chủ ý)                                  |
| PSP        | Giả lập nội bộ trước; VNPay/MoMo sau, khi abstraction đã chịu tải thật                         |
| Metering   | Có ngay từ MVP                                                                                 |
| Stack      | Fastify + PostgreSQL + BullMQ + Drizzle; React (admin-ui), Next.js (portal-ui); pnpm workspace |

## Tiến độ

| Phase | Nội dung                                                               | Trạng thái | ADR                                                  |
| ----- | ---------------------------------------------------------------------- | ---------- | ---------------------------------------------------- |
| 0     | Nền tảng: monorepo, `Money`, outbox + relay, idempotency key           | Xong       | [0001](adr/0001-phase-0-foundation.md)               |
| 1     | Customer + catalog (price version bất biến, effective dating)          | Xong       | [0002](adr/0002-phase-1-customer-catalog.md)         |
| 2     | Sổ kép append-only, số dư là projection, sửa bằng bút toán đảo         | Xong       | [0003](adr/0003-phase-2-ledger.md)                   |
| 3     | Subscription state machine, entitlement, test clock                    | Xong       | [0005](adr/0005-phase-3-subscription-entitlement.md) |
| 4     | Metering: raw event append-only, dedup 35 ngày, watermark `receivedAt` | Xong       | [0007](adr/0007-phase-4-metering.md)                 |
| 5     | Rating engine thuần (per_unit, graduated, volume, proration)           | Xong       | [0008](adr/0008-phase-5-rating.md)                   |
| 6     | Invoicing draft→finalize→issue, credit note, billing run shard+jitter  | Xong       | [0009](adr/0009-phase-6-invoicing.md)                |
| 7     | Payment orchestration + PSP giả lập + refund                           | Xong       | [0010](adr/0010-phase-7-payments.md)                 |
| 8     | Dunning state machine + webhook gửi ra ngoài                           | Xong       | [0011](adr/0011-phase-8-dunning-webhooks.md)         |
| 9     | Portal (Next.js) + reporting + reconciliation                          | Xong       | [0012](adr/0012-phase-9-portal-reporting.md)         |

Hai ADR không gắn với phase nào: [0004](adr/0004-nullability-policy.md) (chính sách nullable) và
[0006](adr/0006-rule-compliance.md) (vì sao agent không theo rule, và lớp chặn ESLint dựng sau đó).

## Roadmap đã hết. Đây là những gì chặn đường ra production

**Portal chưa có đăng nhập khách hàng — đây là thứ nghiêm trọng nhất.** `/customers/<customerId>`
không kiểm tra người xem là ai; ai có customerId là đọc được hóa đơn của khách đó. **Không được đưa
ra internet ở dạng hiện tại.** Cần magic link + session + tầng API riêng cho portal. Chi tiết trong
[ADR 0012](adr/0012-phase-9-portal-reporting.md) §Hạn chế.

## Nằm ngoài roadmap nhưng sẽ phải trả

**Nợ test.** Hoãn có chủ ý từ đợt dọn rule, và càng để càng đắt:

- Route test qua `fastify.inject` — khoảng 40 route, 4 auth hook, idempotency replay, error shape.
  `apps/api` hiện không có thư mục test nào.
- Unit test cho logic thuần trong service: `assertTransition`, `assertPricesUsable`,
  `resolveInterval`, `resolveTrialEnd`, `assertPriceShape`, `resolveReplay`.

**Thuế và hóa đơn điện tử.** RESEARCH.md §Recommendations xếp việc này vào **giai đoạn 1 (MVP)** vì
là nghĩa vụ pháp lý (NĐ 123/2020, sửa bởi NĐ 70/2025) — không phải giai đoạn 2, và hiện **không nằm
trong phase nào ở trên**. Phần pháp lý thì tích hợp nhà cung cấp chứ không tự xây, nhưng chỗ móc nối
phải tự dựng:

- `taxBehavior` đã có sẵn trên price từ phase 1 nhưng chưa ai đọc;
- dãy số hóa đơn **nội bộ** (`INV-000001`) khác dãy số có **mã cơ quan thuế** của nhà cung cấp —
  hai thứ này không được lẫn.

Đây là điểm cần nói với team kế toán **trước**, không phải sau.

**Deviation đã biết, chờ chốt.** Rating tính `flatAmount` của một bậc chỉ khi số lượng chạm vào bậc
đó, nên usage 0 ra 0 đồng — Stripe được cho là vẫn thu `flat_amount` bậc 1. Chi tiết và lý do trong
[ADR 0008](adr/0008-phase-5-rating.md) §3.

**Webhook chưa có rate limit theo endpoint.** Một đợt relay lớn dội thẳng vào endpoint của khách.
Thấy được khi chạy thật ở phase 8 — chi tiết trong
[ADR 0011](adr/0011-phase-8-dunning-webhooks.md) §Kiểm chứng. Phải thêm trước khi chạy production.

**Callback bất đồng bộ của PSP thật.** `confirmPaymentIntent` hiện giả định PSP trả lời đồng bộ.
Hạ tầng ký/verify đã có từ phase 8, nhưng route `/api/v1/system/*` cho PSP gọi vào thì gắn cùng lúc
với PSP thật. Chi tiết trong [ADR 0010](adr/0010-phase-7-payments.md) §Hạn chế đã biết.

**Notification.** `NotificationQueue` vẫn là một cái tên chưa dùng. Dunning hiện chỉ thử thu lại chứ
không báo gì cho khách.

**Dọn nợ nhỏ.** ~30 negated guard (`if (!x) { throw }`) chưa nhất quán;
`deleteExpiredIdempotencyKeys` và `findEffectivePrice` còn mã hóa điều kiện vào tên method.
