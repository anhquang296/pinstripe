# 0022 — Gỡ `livemode`, test clock bật/tắt theo môi trường

- **Trạng thái.** Accepted
- **Thay thế.** Phần `livemode` của [phase 11 trong ROADMAP-V2](../ROADMAP-V2.md#phase-11--key-model--livemode)

## Bối cảnh

Phase 11 lấy mô hình test/live của Stripe: cột `livemode` trên mọi bảng domain, mọi unique index
thành `(livemode, …)`, API key mang `_live_` / `_test_`, và test clock chỉ gắn được vào dữ liệu
`livemode = false`.

Stripe cần mô hình này vì hàng nghìn merchant bên ngoài phải thử tích hợp ngay trong account
production, và không tự dựng được một Stripe staging. Pinstripe thì khác: đây là tool nội bộ cho bộ
phận kế toán Vexere, người dùng không phải dev bên ngoài, và dựng thêm một môi trường UAT/staging là
việc bình thường.

Cái giá phải trả thì có thật và kéo dài: `livemode` nằm trong 874 chỗ, 148 file, là tham số của gần
như mọi method service, và mọi query phải lọc theo nó. Quên lọc ở một chỗ thì dữ liệu test lẫn vào
báo cáo tài chính thật, mà không lỗi nào báo.

## Quyết định

### 1. Không còn `livemode`

Drop cột `livemode` trên mọi bảng. Các unique index giữ nguyên tính unique trên phần cột còn lại:
`invoices_number_idx (number)`, `customers_email_idx (email)`,
`prices_lookup_key_version_idx (lookup_key, version)`, ledger account `(code, currency[, customer_id])`,
`ledger_transactions_external_id_idx (external_id)`… `number_sequences` khoá lại theo `(name)`, và chỉ
còn một cấu hình billing portal mặc định.

API key vẫn nằm trong bảng `api_keys` với `type` và `scopes`. Token có dạng `sk_<hex>`, không còn
đoạn mode. `RequestAuth` / `PortalAuth` không còn `livemode`.

Muốn thử thì dùng môi trường UAT/staging, với database riêng và deploy riêng.

### 2. Test clock chạy trên dữ liệu thật, bật/tắt bằng `TEST_CLOCKS_ENABLED`

Test clock vẫn được giữ để kiểm thử billing theo thời gian sau khi triển khai. Nó không còn gắn với
test mode, nên sẽ chạy trên dữ liệu của môi trường mà nó được bật:

- `TEST_CLOCKS_ENABLED` mặc định `false`. Bật ở UAT/staging, tắt ở production.
- Khi tắt thì route `/api/v1/test_clocks` không được đăng ký, và tạo customer có `testClockId` sẽ
  bị trả `BadRequestError`.
- Sweep của billing run bỏ qua subscription có `test_clock_id`. Thời gian của những subscription đó
  do test clock điều khiển, không theo giờ thật.

## Hệ quả

- Service và repository mất một tham số ở gần như mọi method, và query không còn filter theo mode.
- Mất khả năng có dữ liệu test và dữ liệu thật trong cùng một database. Đây là chủ đích.
- Ranh giới an toàn của test clock chuyển từ một check constraint trong DB sang một biến môi trường.
  Production phải giữ `TEST_CLOCKS_ENABLED=false`.
