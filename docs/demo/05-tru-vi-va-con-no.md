# KB-05 — Trừ ví nhà xe, và khi ví không đủ tiền

**Thời lượng** ~4 phút · **Màn hình** erp-ui · **Nhà xe** Thành Bưởi

## Kể gì

> Kênh thu thứ hai là trừ thẳng ví nhà xe. Nhưng thực tế ví thường không đủ. Câu hỏi thiết kế là:
> ví có 1,5 triệu mà hoá đơn 21 triệu thì làm gì? Không trừ gì cả, hay trừ được bao nhiêu hay bấy
> nhiêu? VXR ERP chọn vế thứ hai, và đây là lý do.

## Bấm gì

| #   | Ở đâu             | Làm gì                                                           |
| --- | ----------------- | ---------------------------------------------------------------- |
| 1   | `/invoices/draft` | Bấm dòng **Thành Bưởi**                                          |
| 2   | drawer            | Chỉ vào **Cách thu tiền: Trừ ví nhà xe**                         |
| 3   | drawer            | Bấm **Phát hành** → tổng **21.230.000 ₫**, trạng thái `open`     |
| 4   | —                 | Chờ tối đa 60 giây                                               |
| 5   | `/invoices/open`  | F5 — hoá đơn vẫn `open`, nhưng cột **Đã trả** là **1.500.000 ₫** |
| 6   | drawer            | Mở lại hoá đơn: còn lại **19.730.000 ₫**                         |

## Nói gì ở bước 5

> Ví nhà xe chỉ có 1,5 triệu. Hệ thống trừ hết 1,5 triệu đó, ghi nhận là đã trả một phần, và hẹn
> lần thu sau. Hoá đơn không bị đánh là thất bại — nó vẫn mở, và phần còn nợ được cấn trừ vào kỳ
> sau. Đúng như nghiệp vụ mà kế toán Vexere đang làm tay.
>
> Nếu chọn "không đủ thì không trừ", một nhà xe có doanh thu nhỏ giọt sẽ không bao giờ trả được
> đồng nào, và công nợ cứ phình ra.

## Thấy gì

| Chỗ          | Con số       |
| ------------ | ------------ |
| Tổng hoá đơn | 21.230.000 ₫ |
| Đã trừ được  | 1.500.000 ₫  |
| Còn lại      | 19.730.000 ₫ |
| Trạng thái   | vẫn `open`   |

Lần thu tiếp theo được hẹn theo lịch `1, 3, 5, 7` ngày. Hết lượt mà vẫn chưa đủ thì hoá đơn chuyển
`uncollectible` — chứ không bị xoá.

## Nếu hỏng thì

| Hiện tượng           | Thật ra là                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Trừ được **0 đ**     | Ví đã bị trừ hết ở một lần demo trước. `db:reset` rồi **khởi động lại `pnpm dev`** mới nạp lại số dư |
| Trừ được đủ 21 triệu | `MOCK_VEXERE_BALANCES` đang để số dư ví quá lớn — kiểm lại `.env`                                    |

## Câu hỏi hay bị hỏi

**"Nếu nhà xe tự chuyển khoản trả giữa hai lần thu thì sao?"** Lần thu sau chỉ đòi đúng phần còn
nợ. Nếu Vexere lỡ trừ nhiều hơn phần còn nợ thì phần dư phải đối soát tay — đây là một hạn chế đã
biết, ghi trong ADR 0023.

**"Có hoàn ngược vào ví được không?"** Không. Hoàn tiền ở đây đi qua credit note hoặc số dư khách
hàng; việc bơm ngược vào ví là nghiệp vụ bên Vexere.

Tiếp theo: [KB-06 — Cổng nhà xe](./06-portal-nha-xe.md)
