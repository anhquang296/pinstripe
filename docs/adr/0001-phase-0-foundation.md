# ADR 0001 — Nền tảng Phase 0

Ngày: 2026-09-15
Trạng thái: Accepted

## Bối cảnh

[RESEARCH.md](../RESEARCH.md) chốt các trụ cột kiến trúc (ledger append-only, transactional outbox,
idempotency + dedup, tách entitlement khỏi billing) nhưng đề xuất NestJS. Team chọn Fastify, Drizzle,
BullMQ, pnpm workspace. Phase 0 dựng nền để 7 nguyên tắc bất biến trở thành thứ có sẵn.

## Quyết định

1. **Fastify thay NestJS.** Repo đã có bộ rule `profiles/fastify/*`; plugin/registry của Fastify đủ
   để cưỡng chế ranh giới module mà không cần DI container.
2. **Worker là một Fastify instance headless.** `apps/worker` đăng ký đúng `corePlugin` như
   `apps/api`, chỉ khác là không phục vụ route nghiệp vụ mà khởi tạo một workflow BullMQ. Nhờ vậy
   service dùng chung cho HTTP và job, không có hai composition root.
3. **Một workflow một tiến trình**, chọn bằng `WORKFLOW_NAME`. `pnpm dev` chạy `outbox` và
   `domain-event` song song qua concurrently.
4. **Tiền là `number` minor unit, không phải `bigint`.** Stripe API cũng dùng integer; VND lớn nhất
   vẫn nằm trong `Number.MAX_SAFE_INTEGER`. `Money.of()` từ chối mọi giá trị không phải safe integer,
   nên không có đường nào để float lọt vào.
5. **Outbox claim bằng `UPDATE ... FOR UPDATE SKIP LOCKED`** thay vì `SELECT` rồi update: nhiều relay
   worker chạy song song không giành nhau cùng một event.
6. **API key tạm thời đọc từ env** (`SECRET_API_KEY`, `ADMIN_API_KEY`, `SYSTEM_API_KEY`,
   `MANAGEMENT_API_KEY`). Bảng `api_keys` gắn với account sẽ thay thế ở phase sau. Key chỉ được đọc
   trong `api-key.plugin.ts` — không hook nào đọc `fastify.config`.
7. **admin-ui không giữ API key.** Vite proxy gắn `Authorization` phía server ở môi trường dev;
   khi có session auth thật thì bỏ proxy này.
8. **Idempotency scope = `default`.** Khi có account/tenant, scope đổi thành account id — khoá
   unique đã tính sẵn cột `scope` nên không phải migrate lại.

## Hệ quả

- Mọi service mới lấy dependency qua `fastify.*` do registry plugin decorate, không tự `new`.
- Mọi event ra ngoài phải đi qua `OutboxService.recordEvents()` trong cùng transaction nghiệp vụ.
- Sửa `packages/core` mà app không thấy đổi → kiểm tra đã rebuild core chưa (exports trỏ vào `dist`).
