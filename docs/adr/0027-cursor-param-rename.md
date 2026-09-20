# 0027 — Tham số cursor là `after` / `before`

- **Trạng thái.** Accepted
- **Thay thế một phần.** [0002 — Customer & Catalog (Phase 1)](0002-phase-1-customer-catalog.md) §4,
  chỗ nói mọi thứ ngoài camelCase đều bám Stripe.

## Bối cảnh

Từ phase 1, tham số phân trang mang đúng tên Stripe: `startingAfter` / `endingBefore`. Đó không phải
một cân nhắc riêng về naming, mà là hệ quả của quyết định "bám Stripe" ở ADR 0002 §4.

Hai điểm khiến cặp tên đó không đáng giữ:

- **Dài mà không thêm nghĩa.** `limit` đã nói hướng đọc, nên "starting" và "ending" không phân biệt
  thêm điều gì. `after` / `before` là cặp tên GitHub và Relay dùng.
- **Tên theo vị trí, nằm cạnh một tầng đặt tên theo thời gian.** List sắp `created_at DESC`, nên
  `startingAfter` — "sau" trong thứ tự kết quả — là **cũ hơn**, và service map nó sang `beforeAt` của
  repository. Nghịch đảo đó vẫn còn sau khi đổi tên; rút ngắn tên không sửa được nó, nhưng khiến nó
  ít phải đọc hơn.

## Quyết định

1. **Tham số cursor trên wire là `after` và `before`.** Áp dụng cho mọi `find*` schema trong
   `packages/core/src/contracts`, và do đó cho cả `@pinstripe/sdk` và `openapi.json`.
2. **Clean break, không nhận tên cũ.** Không có giai đoạn nhận cả hai tên, không alias, không
   `deprecated`. Mọi `find*` schema khai `additionalProperties: false`, nên request gửi
   `startingAfter` bị từ chối **400** chứ không im lặng bỏ qua — với một hệ tính tiền, im lặng là
   sai, theo đúng lập luận của ADR 0002 §2.
3. **Từ vựng các tầng khác không đổi.** `beforeAt` / `afterAt` vẫn là tên filter của repository
   (bound loại trừ), `from` / `to` vẫn dành cho bound bao gồm. `after` / `before` chỉ sống trên wire
   và trong hook tiêu thụ nó.
4. **ADR 0002 §4 nay có hai ngoại lệ**, không phải một: camelCase, và tên tham số cursor.

## Hệ quả

- Đối tác đã tích hợp phải sửa call site; không có đường nâng cấp dần.
- `useCursorPagination` trả `after` thay cho `startingAfter`; hai app tiêu thụ đổi theo.
- Vòng lặp tự phân trang trong `InvoiceService.exportCustomerInvoices` đổi biến local theo cùng tên.
- `apps/api/openapi.json` phải sinh lại (`pnpm --filter @pinstripe/api openapi`) mỗi khi đụng vào
  contract, và commit cùng thay đổi.
- Không được đổi ngược về `startingAfter` / `endingBefore`, hay thêm lại chúng như alias, nếu không
  huỷ ADR này trước.
