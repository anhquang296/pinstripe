# ADR 0016 — Mô hình thuế

**Trạng thái.** Đã chốt, phase 15.

## Bối cảnh

Phase 13 để lại `invoices.totalTaxAmount`, `subtotalExcludingTax`,
`invoice_line_items.amountExcludingTax` và một cột jsonb `tax_amounts` mà không ai ghi vào.
`prices.taxBehavior` tồn tại từ phase 1 và chưa bao giờ được đọc. Tài khoản `tax_payable` có trong
biểu đồ tài khoản từ phase 2 và số dư luôn bằng không. Phase 15 làm cho cả bốn thứ đó có nghĩa.

Với một triển khai nội bộ có xuất hoá đơn, đây là nghĩa vụ pháp lý (NĐ 123/2020, sửa bởi NĐ 70/2025)
chứ không phải một tính năng "cho giống Stripe".

## Quyết định

### 1. Thuế đóng băng lúc finalize, và snapshot xuống dòng

Draft không có thuế. `writeFinalizedInvoice` chạy ba bước trong đúng một transaction:
`applyDiscounts` → `applyTaxes` → `assembleInvoiceTotals`. Mỗi dòng thuế được ghi thành một hàng
`invoice_line_item_tax_amounts` mang `taxRateId` **và** bản chụp `percentage`, `isInclusive`,
`taxType`, `taxableAmount`.

Thuế suất đổi theo thời gian; một hoá đơn đã phát không được đổi theo. `updateTaxRate` vì thế chỉ
nhận `displayName` / `description` / `jurisdiction` / `active` / `metadata` — `percentage` và
`inclusive` không sửa được, muốn đổi thì tạo rate mới và tắt rate cũ.

Cột jsonb `tax_amounts` bị xoá. Một bảng thật cho phép join, tổng hợp theo `taxType` và theo
jurisdiction — việc mà một hoá đơn thuế thật sự cần — và nó là con của `invoice_line_items`, vốn đã
append-only từ `0011_invoice_immutability`.

### 2. Thuế tính trên `amount - discountAmounts` của **từng dòng**

ADR 0015 cố tình trừ giảm giá xuống dòng thay vì xuống hoá đơn, đúng để bước này không phải phân bổ
ngược. `taxableAmount` của một dòng là phần còn lại sau mọi `discountAmounts` đã ghi.

### 3. Làm tròn inclusive đi qua `Money.allocate`

Một rate exclusive: `thuế = round(base × p/100)`, half up.

Một rate inclusive: thuế đã nằm trong `base`, nên moi ngược ra bằng `base × p/(100+p)`.

Nhiều rate inclusive trên cùng một dòng: tính **một** số gộp từ `P = Σpᵢ` rồi `Money.allocate` số đó
theo trọng số `pᵢ`. Tính từng rate rồi cộng lại là cỗ máy sinh lệch một đồng mà roadmap gọi tên:
`Σ round(base × pᵢ/(100+P))` không bằng `round(base × P/(100+P))`. Đi qua `allocate` thì tổng luôn
khớp và phần dư vào rate có phần lẻ lớn nhất — cùng hành vi giảm giá đã dùng từ phase 2.

### 4. `taxBehavior` của price thắng cờ `inclusive` của rate

| `price.taxBehavior` | Dòng đó tính thuế thế nào |
| ------------------- | ------------------------- |
| `inclusive`         | inclusive, bất kể rate    |
| `exclusive`         | exclusive, bất kể rate    |
| `unspecified`       | theo `taxRate.inclusive`  |

Giá là thứ khách đã nhìn thấy; nó quyết định con số đã gồm thuế hay chưa. Rate chỉ mô tả sắc thuế.
Dòng không có price (`invoice_items` nhập tay) luôn là `unspecified`.

### 5. Thứ tự tra thuế suất, và `automaticTax` là một provider

`TaxProvider.calculate(draft) → taxAmounts` là interface; `TableTaxProvider` là cài đặt tra bảng duy
nhất hiện có, dựng ở `tax.plugin.ts`. Thứ tự:

1. Rate gắn thẳng vào dòng — `invoice_items.taxRates` hoặc `subscription_items.taxRates`.
2. Không có thì `invoices.defaultTaxRates`; hoá đơn chu kỳ thừa hưởng nó từ
   `subscriptions.defaultTaxRates` lúc dựng draft.
3. Vẫn không có **và** `automaticTax.enabled` thì tra `tax_rates` theo `country`/`state` của địa chỉ
   khách (`state` khớp hoặc null).

`automaticTax.status` phản ánh kết quả: `not_collecting` khi tắt hoặc khách miễn thuế,
`requires_location_inputs` khi bật mà khách không có `country`, `complete` khi tra được.
`customer.taxExempt` khác `none` thì provider trả về rỗng — miễn thuế cắt ở provider, không phải ở
từng call site.

### 6. Hai dãy số không được lẫn

`INV-000001` là dãy **nội bộ**, cấp bởi `number_sequences` trong transaction finalize.
`authorityInvoiceNumber` là số có mã cơ quan thuế, do nhà cung cấp hoá đơn điện tử cấp, và hôm nay
luôn `null`. `authorityStatus` đi kèm để phase 24 chỉ phải viết một adapter chứ không phải một
migration.

`authorityStatus` là enum có member `not_submitted` chứ **không** nullable, dù roadmap viết
"nullable": `nullability-convention.md` §"A flag has two states" không cho enum nullable, và
"chưa gửi cơ quan thuế" là một trạng thái có tên, không phải một chỗ trống.

### 7. `tax_ids` là object hạng nhất, verify là stub

Một hàng `tax_ids` mang `type`, `value`, `country` và ba cột verification. Tạo tax id thì dispatch
`TaxIdVerify` lên `TaxQueue`; `TaxWorkflow` gọi `taxIdService.verifyTaxId`, hôm nay chỉ kiểm format
theo `type` và ghi `verified`/`unverified`. Cột `customers.taxId` cũ vẫn còn cho tương thích, nhưng
thứ mà hoá đơn nên đọc là bảng.

## Hệ quả

- `postReceivable` / `reverseReceivable` **không đổi**: chúng đã đọc `totals.totalTaxAmount` từ phase
  13, nên `tax_payable` có số ngay khi thuế có số, và void đảo đúng cả hai vế.
- `total` chỉ cộng phần thuế **exclusive**: thuế inclusive đã nằm trong `subtotal`.
  `subtotalExcludingTax` và `amountExcludingTax` là chỗ nhìn ra phần gốc.
- Hoá đơn VND thuế inclusive và hoá đơn USD thuế exclusive dùng đúng một đường ống, khác nhau ở
  đúng hai cờ.

## Chệch có chủ ý so với Stripe

- `tax_rates.percentage` và `inclusive` bất biến; Stripe cũng vậy, nhưng ở đây `taxType` là cột bắt
  buộc vì hoá đơn Việt Nam cần sắc thuế.
- Không có Stripe Tax: `automaticTax` là một provider tra bảng nội bộ, không gọi ra ngoài. Interface
  giữ đúng hình dạng để phase 24 cắm nhà cung cấp thật vào.
- `tax_ids` là `POST /v1/tax_ids` ở mức top-level với `customerId` trong payload, không phải
  subresource của customer.
