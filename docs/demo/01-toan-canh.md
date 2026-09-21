# KB-01 — Toàn cảnh: Vexere đang thu tiền 5 nhà xe

**Thời lượng** ~4 phút · **Màn hình** erp-ui (http://localhost:5173)

## Kể gì

> Đây là hệ thống tính tiền của Vexere với các nhà xe. Nó không phải một bảng Excel công nợ — nó là
> một nền tảng billing đầy đủ: danh mục dịch vụ, hợp đồng thuê bao, đo lượng dùng, phát hành hoá đơn,
> thu tiền, và ghi sổ kế toán kép. Dữ liệu đang thấy là bốn tháng vận hành.

## Bấm gì

| #   | Ở đâu                         | Làm gì                                     | Nói gì                                                                                                               |
| --- | ----------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`                           | Để nguyên màn Tổng quan                    | "MRR gần 49 triệu, ARR 585 triệu. Bốn nhà xe đang chạy, một đang dùng thử."                                          |
| 2   | `/`                           | Chỉ vào khối **Đối soát nhanh**            | "Tiền ở cổng thanh toán và tiền trên sổ cái khớp nhau, chênh lệch 0. Quay lại chỗ này ở cuối buổi."                  |
| 3   | `/billing/customers`          | Mở danh sách                               | "Năm nhà xe thật: Phương Trang, Thành Bưởi, Hoàng Long, Kumho Samco, Sao Việt."                                      |
| 4   | `/billing/customers`          | Bấm vào dòng **Phương Trang** để mở drawer | "Mã số thuế, email kế toán, địa chỉ — và hai tài khoản cổng nhà xe: chủ xe và kế toán."                              |
| 5   | `/billing/catalog/products`   | Mở tab Products                            | "Ba dịch vụ Vexere bán cho nhà xe: nền tảng bán vé, phần mềm quản lý nhà xe, và ZNS chăm sóc khách."                 |
| 6   | `/billing/catalog/prices`     | Đổi sang tab Prices                        | "Bốn bảng giá. Chú ý `booking_ticket_fee` — **2 tier (graduated)**: 10.000 vé đầu 2.000 đ/vé, vượt bậc còn 1.500 đ." |
| 7   | `/billing/catalog/prices`     | Chỉ vào cột Version                        | "Giá là bất biến. Tăng giá là sinh version mới, hợp đồng cũ vẫn chạy giá cũ."                                        |
| 8   | `/billing/subscriptions/list` | Mở danh sách thuê bao                      | "Bốn `active`, một `trialing` — Sao Việt mới ký, đang dùng thử 14 ngày, chưa có hoá đơn nào."                        |

## Thấy gì

- Tổng quan: **MRR 48.750.700 ₫**, ARR **585.008.400 ₫**, thuê bao đang chạy **4**, dùng thử **1**.
- Đối soát nhanh: cổng thanh toán và sổ cái bằng nhau, **chênh lệch 0 ₫**, **0 mục lệch**.
- `/billing/catalog/prices`: thẻ **TÍNH THEO BẬC = 1**.
- `/billing/subscriptions/list`: không dòng nào `past_due`.

## Nếu hỏng thì

| Hiện tượng             | Làm gì                                                           |
| ---------------------- | ---------------------------------------------------------------- |
| MRR = 0                | Subscription chưa có, chạy lại `pnpm seed:demo`                  |
| Bảng trống             | Chưa đăng nhập hoặc session hết hạn — đăng nhập lại              |
| Có thuê bao `past_due` | Đã có hoá đơn quá hạn bị dunning chạm vào; `db:reset` + seed lại |

## Câu hỏi hay bị hỏi

**"MRR tính thế nào?"** Quy mọi gói định kỳ đang `active` về đơn vị tháng, rồi trừ khuyến mãi đang
hiệu lực. Chỉ tính phần cố định — phần theo lượng dùng không nằm trong MRR vì nó chưa cam kết.

**"Sao giá không sửa được?"** Vì hoá đơn đã phát hành phải tái lập lại được. Muốn đổi giá thì tạo
version mới; hợp đồng cũ vẫn trỏ version cũ cho tới khi chuyển.

Tiếp theo: [KB-02 — Onboard nhà xe mới](./02-onboard-va-dang-ky.md)
