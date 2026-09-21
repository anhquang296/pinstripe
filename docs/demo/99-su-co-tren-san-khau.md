# 99 — Sự cố trên sân khấu

Mở sẵn file này ở một tab. Mỗi mục sửa được trong dưới 30 giây.

## Ba lỗi hay gặp nhất

### 1. Cấn trừ / trừ ví trả về 0 đ

**Gần như luôn là**: `pnpm dev` chưa được khởi động lại sau lần `db:reset` hoặc sau khi sửa `.env`.

Số dư giả của đối tác nằm trong bộ nhớ của tiến trình worker, nạp **một lần lúc boot** từ
`MOCK_VEXERE_BALANCES`. Reset database không nạp lại nó, và một lần demo trước đã tiêu hết số dư.

```bash
pnpm dev:stop && pnpm dev
```

### 2. Mọi lời gọi API trả "Invalid API key"

**Là vì**: `db:reset` đã chạy trong lúc API đang bật. Bảng `api_keys` được dựng lại lúc API khởi
động, nên reset xong mà không restart thì không còn khoá nào trong database.

```bash
pnpm dev:stop && pnpm dev
```

Cùng lý do đó, `db:reset` cũng xoá phiên đăng nhập dashboard — phải đăng nhập lại, và phải chạy lại
`bootstrap-admin` vì bảng user cũng trắng.

### 3. Thứ tự đúng, thuộc lòng

```bash
pnpm dev:stop
pnpm db:reset
pnpm dev                      # đợi API trả lời /healthz
pnpm --filter @vxrerp/api bootstrap-admin -- --email admin@vxrerp.test --name Admin --password 'demo-vxrerp-2026'
pnpm seed:demo
```

**Reset là phải restart.** Ba bước cuối không đảo được.

## Bảng tra nhanh

| Hiện tượng                                 | Thật ra là                                                            | Sửa                                                      |
| ------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Entitlement trống sau khi tạo subscription | worker `domain-event` đến muộn vài giây                               | chờ 5 giây rồi F5                                        |
| Hoá đơn nháp hiện **0 ₫**                  | đúng như thiết kế — số tiền đóng băng lúc phát hành                   | nói ra, đó là một điểm hay                               |
| Phát hành xong 90 giây vẫn `open`          | worker `dunning` chưa chạy vòng nào                                   | chờ thêm một phút, hoặc xem mục 1                        |
| Bảng trắng, không lỗi                      | phiên dashboard hết hạn (12 giờ) hoặc vừa bị reset                    | đăng nhập lại                                            |
| Email không tới Mailpit                    | `apps/operator-portal/.env.local` thiếu `VXRERP_PORTAL_API_KEY`       | thêm vào rồi khởi động lại portal                        |
| Link đăng nhập cổng báo hết hạn            | link dùng một lần, sống 15 phút                                       | xin link mới từ `/login`                                 |
| Không có mã VietQR trên hoá đơn            | bốn biến `BANK_TRANSFER_*` đang trống                                 | điền vào `.env`, restart                                 |
| Refund trả lỗi 500                         | cổng thanh toán giả giữ giao dịch trong RAM, `pnpm dev` reload là mất | tránh demo refund sau khi vừa sửa code                   |
| Test clock kẹt trạng thái `advancing`      | tiến trình chết giữa hai bước                                         | `update test_clocks set status='ready'` (câu SQL ở dưới) |
| Tua test clock mà không sinh hoá đơn       | job nền chạy theo giờ thật và bỏ qua thuê bao có test clock           | phát hành hoá đơn bằng tay                               |
| Có thuê bao `past_due` ngay từ đầu         | hoá đơn quá hạn đã bị dunning chạm tới                                | seed lại cho sạch                                        |
| Port bị chiếm, `pnpm dev` không lên        | tiến trình cũ còn sống                                                | `pnpm dev:stop`                                          |

## Vài câu SQL cấp cứu

Mở một terminal riêng, dán thẳng:

```bash
docker compose -f docker/compose.yml exec -T postgres psql -U vxrerp -d vxrerp -c "<câu SQL>"
```

| Cần gì                      | Câu SQL                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Xem trạng thái hoá đơn      | `select number, status, total, amount_paid from invoices order by created_at desc limit 10`                                                                                                        |
| Xem các lần thu qua đối tác | `select invoice_id, requested_amount, applied_amount, status from collection_attempts`                                                                                                             |
| Gỡ test clock kẹt           | `update test_clocks set status='ready' where status='advancing'`                                                                                                                                   |
| Kiểm sổ cái có cân không    | `select transaction_id, sum(case when direction='debit' then amount else -amount end) d from ledger_postings group by 1 having sum(case when direction='debit' then amount else -amount end) <> 0` |

Câu cuối trả về 0 dòng là sổ cân.

## Nếu hỏng nặng, còn 2 phút

Bỏ phần đang kẹt, chuyển sang [KB-07 — Sổ cái và đối soát](./07-so-cai-va-doi-soat.md). Nó chỉ đọc,
không phụ thuộc worker nào, và là phần thuyết phục nhất với khán giả tài chính.
