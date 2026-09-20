# Kịch bản demo Pinstripe

Bộ tài liệu đọc-và-làm-theo cho một buổi demo. Khác `docs/usecases/` ở chỗ nó **không giải thích cơ
chế** — nó nói bấm gì, thấy gì, và nói gì trước khán giả.

## Chuẩn bị

[00 — Chuẩn bị trước giờ demo](./00-chuan-bi.md) — làm trước 15 phút. Ba lệnh và một checklist 8 ô.

## Mạch kịch bản

```
01 Toàn cảnh ─► 02 Onboard ─► 03 Usage ─► 04 Cấn trừ vé ⭐ ─► 05 Trừ ví ─► 06 Cổng nhà xe ─► 07 Sổ cái
```

| #                                | Kịch bản                           | Phút | Màn hình           |
| -------------------------------- | ---------------------------------- | ---- | ------------------ |
| [01](./01-toan-canh.md)          | Vexere đang thu tiền 5 nhà xe      | 4    | admin-ui           |
| [02](./02-onboard-va-dang-ky.md) | Nhận nhà xe mới và ký gói          | 5    | admin-ui           |
| [03](./03-usage-va-xem-truoc.md) | Đo lượng dùng, xem trước số tiền   | 5    | admin-ui           |
| [04](./04-can-tru-tien-ve.md) ⭐ | Thu tiền bằng cấn trừ doanh thu vé | 6    | admin-ui           |
| [05](./05-tru-vi-va-con-no.md)   | Trừ ví, ví thiếu thì còn nợ        | 4    | admin-ui           |
| [06](./06-portal-nha-xe.md)      | Cổng nhà xe và email               | 6    | portal-ui, Mailpit |
| [07](./07-so-cai-va-doi-soat.md) | Sổ cái kép và đối soát             | 6    | admin-ui           |
|                                  | **Tổng**                           | ~36  |                    |

[99 — Sự cố trên sân khấu](./99-su-co-tren-san-khau.md) — mở sẵn ở một tab.

## Rút ngắn còn 15 phút

Bỏ 02, 03, 05. Giữ **01 → 04 → 06 → 07**: toàn cảnh, kênh thu đặc thù, cái nhà xe nhìn thấy, và sổ
sách. Đó là bốn điều khác biệt so với một bảng công nợ Excel.

## Ba câu chốt

1. **Kênh thu chính không phải thẻ.** Tiền của nhà xe đã nằm ở Vexere; thu tiền nghĩa là cấn trừ
   doanh thu vé hoặc trừ ví — và thu được bao nhiêu thì ghi nhận bấy nhiêu.
2. **Nhà xe tự xem được công nợ.** Đăng nhập bằng email, có mã VietQR đúng nội dung chuyển khoản,
   nên bớt hẳn một vòng gọi điện đối chiếu.
3. **Mọi đồng tiền đều có bút toán kép, và sổ không sửa được.** Sai thì đảo, không xoá — và hệ thống
   tự đối soát tiền cổng thanh toán với tiền trên sổ mỗi ngày.

## Dữ liệu demo đến từ đâu

`pnpm seed:demo` → `apps/api/scripts/seed-demo/`. Script gọi thẳng service của `packages/core`, nên
dữ liệu đi đúng đường mà hệ thống thật đi: có outbox, có event, có entitlement, có bút toán, số hoá
đơn do chính hệ thống cấp. Bước cuối lùi ngày các hoá đơn cũ về bốn tháng trước để báo cáo và cổng
nhà xe trông như một hệ thống đã chạy lâu.
