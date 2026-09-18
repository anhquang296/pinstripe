# ADR 0015 — Mô hình giảm giá

**Trạng thái.** Đã chốt, phase 14.

## Bối cảnh

Phase 13 đã dựng chỗ chứa: `invoice_line_items.discountAmounts`, `invoices.totalDiscountAmount`,
`subtotalExcludingTax`. Phase 14 điền số vào đó. Ba câu hỏi roadmap bắt phải chốt trước khi viết.

## Quyết định

### 1. Giảm giá trừ vào **dòng**, trước thuế, tuần tự trên số dư đang chạy

Một giảm giá nhìn vào phần **còn lại** của mỗi dòng đủ điều kiện — `amount` trừ đi mọi
`discountAmounts` đã ghi — cộng lại thành `base`, tính ra một số tiền, rồi `money.allocate` số tiền
đó xuống từng dòng theo trọng số là phần còn lại ấy. Phần dư đi vào dòng có phần lẻ lớn nhất, đúng
hành vi `allocate` đã có từ phase 2.

Thứ tự áp là `createdAt, id` của `discounts`. Hai giảm giá 20% chồng nhau trên 1.000.000 ra
200.000 + 160.000, không phải 400.000 — giống Stripe.

Trừ vào dòng chứ không vào hoá đơn, để phase 15 tính thuế trên gốc đã giảm mà không phải phân bổ
ngược.

### 2. `durationInMonths` đếm từ `discount.startAt`

`startAt` là lúc discount được tạo. `endAt = startAt + durationInMonths` tháng, tính bằng
`advancePeriod`. Không neo vào chu kỳ subscription: một discount có thể sống ở mức customer, nơi
không có chu kỳ nào để neo vào.

### 3. Cửa sổ hiệu lực đọc tại `invoice.periodStart`, không phải lúc finalize

Một discount áp được cho hoá đơn khi `startAt <= invoice.periodStart < endAt`. Hệ bill in arrears,
nên hoá đơn của kỳ đầu finalize ở cuối kỳ; đọc theo mốc finalize sẽ làm một coupon 3 tháng chỉ ăn
được hai hoá đơn. Đọc theo `periodStart` cho đúng ba.

`duration: once` không có `endAt` lúc tạo; bước áp giảm giá đóng nó lại bằng `endAt = periodStart`
ngay trong transaction finalize, nên nó không bao giờ ăn hoá đơn thứ hai.

### 4. Bộ đếm redemption tăng lúc tạo discount

`UPDATE coupons SET times_redeemed = times_redeemed + 1 WHERE id = ? AND (max_redemptions IS NULL OR
times_redeemed < max_redemptions) RETURNING *`. Không đọc-rồi-ghi, nên hai request song song không
thể vượt `maxRedemptions`. `promotion_codes` dùng đúng hình dạng đó.

## Chệch có chủ ý so với Stripe

- `discounts` là resource hạng nhất có `POST /v1/discounts`. Stripe chỉ cho gắn coupon qua
  customer/subscription. Ở đây một route duy nhất phục vụ cả năm mức, và `level` là cột thật.
- Ràng buộc `minimumAmount` của promotion code kiểm ở **bước áp**, so với `subtotal` của hoá đơn —
  lúc tạo discount chưa có hoá đơn nào để so.
- `firstTimeTransaction` kiểm lúc tạo discount, dựa trên việc khách đã có hoá đơn `paid` nào chưa.

## Hệ quả

- `ReportingService.aggregateRevenueSummary` trừ giảm giá đang hiệu lực khỏi MRR, nên MRR là doanh
  thu sau giảm.
- `postReceivable` không đổi: nó đã đọc `totals.total`, vốn nay đã trừ giảm giá.
- Thuế (phase 15) tính trên `amount - discountAmounts` của từng dòng.
