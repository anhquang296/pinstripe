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
| **8** | **Dunning state machine + webhook gửi ra ngoài**                       | Chưa       | —                                                    |
| **9** | **Portal (Next.js) + reporting + reconciliation**                      | Chưa       | —                                                    |

Hai ADR không gắn với phase nào: [0004](adr/0004-nullability-policy.md) (chính sách nullable) và
[0006](adr/0006-rule-compliance.md) (vì sao agent không theo rule, và lớp chặn ESLint dựng sau đó).

## Phase 8 — Dunning & webhook

- State machine nhắc nợ: hóa đơn `open` quá hạn → retry theo lịch → `uncollectible`. Trạng thái
  `uncollectible` đã có sẵn trong state machine của phase 6 nhưng **chưa ai chuyển sang nó**.
- Webhook **gửi ra ngoài**: endpoint đăng ký, ký payload (`WEBHOOK_SIGNING_SECRET` đã có trong env
  từ phase 0), retry với backoff, consumer phải idempotent.
- Đây cũng là chỗ xử lý callback bất đồng bộ của PSP thật. **PSP giả lập của phase 7 trả lời đồng bộ,
  PSP thật thì không** — `confirmPaymentIntent` sẽ chỉ đẩy intent sang `processing`, và một webhook
  handler idempotent mới là chỗ chuyển sang `succeeded`. Chi tiết trong
  [ADR 0010](adr/0010-phase-7-payments.md) §Hạn chế đã biết.

## Phase 9 — Portal, reporting, reconciliation

- `apps/portal-ui` hiện là skeleton Next.js rỗng (mỗi `layout.tsx` + `page.tsx`).
- Reporting: MRR/ARR/churn đọc từ read model, không tính trên bảng giao dịch.
- Đối soát 3 chiều (ledger nội bộ ↔ PSP ↔ ngân hàng) + exception workflow — RESEARCH.md xếp
  reconciliation vào loại "không phải tùy chọn".

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

**Dọn nợ nhỏ.** ~30 negated guard (`if (!x) { throw }`) chưa nhất quán;
`deleteExpiredIdempotencyKeys` và `findEffectivePrice` còn mã hóa điều kiện vào tên method.
