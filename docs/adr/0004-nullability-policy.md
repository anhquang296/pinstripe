# ADR 0004 — Chính sách nullable

Ngày: 2026-09-15
Trạng thái: Accepted

## Bối cảnh

Trước phase 3, audit lại 32 cột nullable dựa trên lập luận của Ben Nadel ("NULL không nên dùng trừ
khi bắt buộc": logic ba giá trị, rơi khỏi `NOT LIKE`, bị aggregate bỏ qua, app phải kiểm tra hai lần).
Lập luận đúng cho cột free-text, nhưng áp máy móc vào schema billing thì hỏng ở ba chỗ cụ thể.

## Quyết định

1. **NULL được giữ vì bốn lý do**: state chưa xảy ra (`deleted_at`, `published_at`), identity vắng
   mặt (`ledger_accounts.customer_id`), unique index thưa (`external_id`, `email`, `lookup_key`), và
   không-áp-dụng theo hình dạng row (`prices.unit_amount` khi tiered). Chi tiết ở
   `.claude/rules/local/nullability-convention.md`.
2. **6 cột free-text đổi sang `NOT NULL DEFAULT ''`**: `customers.name/description/phone`,
   `products.description/unit_label`, `prices.nickname`. Type phía consumer thành `string`, template
   hóa đơn ở phase 6 không phải `COALESCE`.
3. **`customers.tax_id` giữ nullable** dù cùng nhóm free-text: hóa đơn cho khách không có MST khác
   với hóa đơn chưa thu thập được MST — NĐ 123/2020 phân biệt hai trường hợp này.
4. **4 CHECK constraint cho `prices`** encode discriminated union vào DB:
   `per_unit` ⇒ có `unit_amount`, không `tiers`; `tiered` ⇒ có `tiers` + `tiers_mode`, không
   `unit_amount`; `recurring` ⇒ đủ ba cột recurring; `one_time` ⇒ không cột recurring nào.

## Vì sao không force NOT NULL diện rộng

- `external_id` có unique index: hai bút toán không có external id sẽ đụng nhau nếu cùng mang `''`.
  Cùng vấn đề với `customers.email` và partial unique index của nó.
- `unit_amount = 0` là mức giá hợp lệ (gói free). Sentinel số học nuốt mất khác biệt giữa "miễn phí"
  và "tính theo tier" — đúng loại lỗi sẽ xuất hóa đơn sai mà ledger vẫn cân nên không alert.
- Timestamp không có sentinel an toàn: mọi giá trị giả đều sống sót vào query theo kỳ.
- Postgres 16 xử lý NULL tốt hơn hẳn SQL Server 2006 trong bài viết gốc: NULL vẫn nằm trong btree
  index, có partial index, `IS DISTINCT FROM`, và `COALESCE` gần như miễn phí.

## Hệ quả

- Lỗ hổng thật được vá: trước đó DB cho phép tồn tại price `per_unit` với `unit_amount IS NULL`, và
  rating engine phase 5 sẽ đọc nó thành 0 đồng. Giờ row đó không tạo được, kể cả bằng SQL trực tiếp.
- Cột nullable còn 26; mỗi cột còn lại rơi vào đúng một trong bốn lý do trên.
- Migration đổi NOT NULL phải tự thêm `UPDATE … WHERE … IS NULL` trước `SET NOT NULL` — drizzle chỉ
  sinh hai statement đầu và cuối.
