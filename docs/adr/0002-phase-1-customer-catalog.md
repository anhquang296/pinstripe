# ADR 0002 — Customer & Catalog (Phase 1)

Ngày: 2026-09-15
Trạng thái: Accepted

## Bối cảnh

Phase 1 dựng ba resource đầu tiên theo mô hình Stripe: `customers`, `products`, `prices`. Câu hỏi
kiến trúc thật nằm ở **price**: giá phải bất biến để hợp đồng cũ không bị đổi số khi bảng giá thay đổi.

## Quyết định

1. **Price bất biến + effective dating thay vì sửa tại chỗ.** Mỗi price có `lookupKey` + `version` +
   `effectiveAt`. Đổi giá = tạo row mới cùng `lookupKey`, `version + 1`. `resolvePrice(lookupKey, at)`
   trả version đang có hiệu lực tại thời điểm `at` — đây là cơ chế grandfathering cho subscription cũ
   ở phase 3.
   `POST /v1/prices/:id` chỉ nhận `active`, `nickname`, `metadata`; mọi field khác bị từ chối ở schema
   (`additionalProperties: false`) **và** service chỉ ghi đúng ba field đó.
2. **`removeAdditional: false` cho ajv.** Mặc định Fastify _im lặng xoá_ field lạ, nghĩa là gửi
   `unitAmount` vào update price sẽ trả 200 như thể hợp lệ. Với hệ tính tiền, im lặng là sai — giờ
   trả 400 `body must NOT have additional properties`.
3. **Contract nằm trong `packages/core/src/contracts`, không tách `packages/contracts`.** Schema
   TypeBox cần enum `CurrencyEnum` mà `Money` (core) cũng cần; tách ra sẽ tạo phụ thuộc vòng hoặc
   phải xé `Money` khỏi currency. Một entry point `@pinstripe/core/contracts` cho cả api, worker và
   admin-ui (import type-only) là đủ. Tách package khi có consumer ngoài monorepo.
4. **Wire dùng camelCase, không snake_case như Stripe.** Mọi thứ khác bám Stripe (tên resource,
   `object`, list envelope, `metadata`, cursor `startingAfter`/`endingBefore`). Đổi sang snake_case
   là một lần `sed` ở tầng contract nếu sau này cần.
   _Cursor đã đổi tên thành `after`/`before` — xem [ADR 0027](0027-cursor-param-rename.md)._
5. **`Type.Unsafe<Union>(Type.Enum(XEnum))` cho mọi enum trên wire.** `Type.Enum` suy ra type là
   chính enum, không phải union — DB row và JSON sẽ không gán được. Bọc `Type.Unsafe` giữ validation
   theo enum nhưng type ra là union, đúng rule "union chỉ dùng ở boundary".
6. **Soft delete cho customer và product.** `DELETE /v1/customers/:id` trả `{deleted: true}` như
   Stripe; mọi read đều lọc `deleted_at is null`. Unique index email chỉ áp dụng cho row chưa xoá.
7. **Unique violation → `ConflictError`.** Lỗi driver 23505 được map ở service, không để rò lên thành 500.

## Hệ quả

- Không có endpoint nào sửa được số tiền của một price đã tạo. Muốn đổi giá thì tạo version mới.
- Mọi write đều ghi outbox trong cùng transaction (`customer.created`, `price.created`, …), nên phase
  8 chỉ cần bật webhook là có đủ event.
- Cursor pagination dùng tuple `(created_at, id)` — phải cast `::timestamptz` khi truyền Date vào
  row-value comparison, nếu không postgres.js không suy được kiểu.
