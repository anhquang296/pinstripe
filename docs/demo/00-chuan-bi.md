# Chuẩn bị trước giờ demo

Làm hết mục này **15 phút trước** khi lên sân khấu. Xong thì không đụng gì nữa.

## 1. Dọn sạch và dựng lại

```bash
pnpm dev:stop
pnpm db:reset
```

`db:reset` drop schema, chạy lại toàn bộ migration và xoá mọi key Redis. Phải dừng `pnpm dev` trước,
nếu không worker đang chạy sẽ ghi dữ liệu mới vào giữa lúc reset.

## 2. Kiểm hai biến môi trường

Trong `.env` ở gốc repo:

```
MOCK_VEXERE_BALANCES=ticket_sales:futa-hcm:500000000,wallet:thanhbuoi-hcm:1500000
TEST_CLOCKS_ENABLED=true
```

Dòng đầu là **số dư giả của đối tác**: doanh thu vé của Phương Trang và ví của Thành Bưởi. Không có
nó thì mọi lần cấn trừ đều trừ được 0 đ và [KB-04](./04-can-tru-tien-ve.md) không diễn được. Đọc lúc
boot, nên sửa xong phải khởi động lại `pnpm dev`.

Trong `apps/billing-portal-ui/.env.local` (Next.js không đọc `.env` gốc):

```
VXRERP_API_URL=http://localhost:3000
VXRERP_PORTAL_API_KEY=<đúng giá trị PORTAL_API_KEY ở .env gốc>
```

## 3. Chạy hệ thống

```bash
pnpm dev
```

Đợi tới khi API trả lời:

```bash
curl -s http://localhost:3000/healthz
```

## 4. Tạo tài khoản đăng nhập dashboard

```bash
pnpm --filter @vxrerp/api bootstrap-admin -- --email admin@vxrerp.test --name Admin --password 'demo-vxrerp-2026'
```

Lệnh này idempotent, chạy lại bao nhiêu lần cũng được.

## 5. Nạp dữ liệu demo

```bash
pnpm seed:demo
```

Chạy xong in ra 8 dòng, dòng cuối là `seed-demo hoàn tất`. Nó dựng:

| Thứ              | Số lượng | Ghi chú                                                     |
| ---------------- | -------- | ----------------------------------------------------------- |
| Sản phẩm         | 3        | Nền tảng bán vé · BMS · ZNS                                 |
| Bảng giá         | 4        | trong đó `booking_ticket_fee` là giá bậc thang              |
| Meter            | 2        | `ticket.sold`, `zns.sent`                                   |
| Nhà xe           | 5        | mỗi nhà xe một đường thu tiền khác nhau                     |
| Tài khoản portal | 10       | mỗi nhà xe một chủ xe + một kế toán                         |
| Thuê bao         | 5        | 4 `active`, 1 `trialing` (Sao Việt)                         |
| Hoá đơn          | 20       | 15 đã thu trải 4 tháng, 2 đang mở, 3 bản nháp chờ phát hành |
| Meter event      | 70       | lượng dùng của kỳ đang chạy                                 |

## 6. Năm nhà xe và vai của từng nhà xe

| Nhà xe            | Thu tiền bằng            | Dùng cho kịch bản                   |
| ----------------- | ------------------------ | ----------------------------------- |
| Phương Trang FUTA | cấn trừ doanh thu vé     | [KB-04](./04-can-tru-tien-ve.md)    |
| Thành Bưởi        | trừ ví nhà xe            | [KB-05](./05-tru-vi-va-con-no.md)   |
| Hoàng Long        | chuyển khoản (VietQR)    | [KB-06](./06-portal-nha-xe.md)      |
| Kumho Samco       | thẻ tự động              | [KB-07](./07-so-cai-va-doi-soat.md) |
| Sao Việt          | chưa thu — đang dùng thử | [KB-01](./01-toan-canh.md)          |

## 7. Checklist cuối — tick đủ 8 ô rồi mới bắt đầu

Đăng nhập http://localhost:5173 bằng `admin@vxrerp.test`, rồi soát:

- [ ] `/` — MRR khác 0, "Thuê bao đang chạy" = 4, các thẻ doanh thu 30 ngày có số
- [ ] `/customers` — đủ 5 nhà xe, đúng tên và mã số thuế
- [ ] `/catalog/prices` — 4 bảng giá, `booking_ticket_fee` hiện hai bậc
- [ ] `/subscriptions/list` — 4 `active` + 1 `trialing`, **không có cái nào `past_due`**
- [ ] `/subscriptions/usage` — hai meter, có số liệu kỳ này
- [ ] `/invoices/paid` — hoá đơn trải từ tháng 5 tới tháng 9, số tăng dần theo thời gian
- [ ] `/invoices/draft` — đúng 3 bản nháp: Phương Trang, Thành Bưởi, Kumho
- [ ] `/ledger/transactions` — có bút toán, `/reports` mục Đối soát **không có dòng lệch nào**

Mở sẵn bốn tab trước khi lên sân khấu:

| Tab | Địa chỉ                       |
| --- | ----------------------------- |
| 1   | http://localhost:5173         |
| 2   | http://localhost:3100         |
| 3   | http://localhost:58025        |
| 4   | terminal đang chạy `pnpm dev` |

Gặp sự cố giữa chừng: [99 — Sự cố trên sân khấu](./99-su-co-tren-san-khau.md).
