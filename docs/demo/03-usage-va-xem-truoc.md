# KB-03 — Đo lượng dùng và xem trước số tiền

**Thời lượng** ~5 phút · **Màn hình** admin-ui

## Kể gì

> Phần khó nhất của billing SaaS không phải phí cố định, mà là phần tính theo lượng dùng. Với Vexere
> đó là số vé bán qua nền tảng và số tin ZNS gửi đi. Hệ thống nhận event thô, và tổng hợp **lúc đọc**
> — nên đổi cách tính giá vẫn dựng lại được con số của tháng cũ.

## Bấm gì

| #   | Ở đâu                  | Làm gì                                                                                       |
| --- | ---------------------- | -------------------------------------------------------------------------------------------- |
| 1   | `/subscriptions/usage` | Mở tab Usage-based billing — hai meter: `ticket.sold` và `zns.sent`                          |
| 2   | `/subscriptions/usage` | Bấm dòng **Vé bán qua nền tảng** để mở drawer                                                |
| 3   | drawer                 | Ở mục "Lượng dùng 30 ngày gần nhất", chọn khách hàng **Phương Trang**                        |
| 4   | drawer                 | Đọc to con số: **12.400 vé** trong **14 event**                                              |
| 5   | drawer                 | Kéo xuống mục **Bắn một event**, chọn Phương Trang, giá trị `250`, bấm gửi                   |
| 6   | drawer                 | Chọn lại khách hàng ở mục tổng hợp → con số thành **12.650**                                 |
| 7   | `/subscriptions/list`  | Mở drawer thuê bao **Phương Trang**, chọn tab **Hoá đơn sắp tới**                            |
| 8   | drawer                 | Chỉ vào các dòng: phí nền tảng, phí theo đầu xe, phí theo vé (đã áp bậc thang), phí ZNS, VAT |

## Thấy gì

- Bước 4: **12.400** — đúng bằng số vé nhà xe này bán trong kỳ.
- Bước 8: tổng trước thuế **66.075.000 ₫**, trong đó vé là 23.600.000 ₫ = 10.000 × 2.000 + 2.400 × 1.500.
- Bước 6: số tăng ngay, không phải chờ worker. Đường ghi usage là đồng bộ.
- Bước 8: xem trước **không ghi gì vào database** — nó chạy bộ tính giá trên dữ liệu hiện tại.

## Nói gì ở bước 8

> Đây là câu trả lời cho "nếu chốt sổ ngay bây giờ thì nhà xe này phải trả bao nhiêu". Nó tính lại
> mỗi lần mở, nên kế toán đối chiếu trước khi phát hành được. Và vì giá vé là bậc thang, 10.000 vé
> đầu tính 2.000 đ, phần vượt tính 1.500 đ — bạn thấy nó tách thành hai dòng.

## Nếu hỏng thì

| Hiện tượng                      | Làm gì                                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| Mục tổng hợp trống              | Chưa chọn khách hàng — chọn ở dropdown bên phải tiêu đề mục          |
| Bắn event mười lần ra mười dòng | Đúng như vậy: form không gửi `identifier` nên không có khử trùng lặp |
| Tab "Hoá đơn sắp tới" trống     | Thuê bao đang `trialing` thì chưa có gì để tính — chọn nhà xe khác   |

## Câu hỏi hay bị hỏi

**"Event trùng thì sao?"** Mỗi event mang một `identifier`; hệ thống nhớ nó 35 ngày và bỏ bản thứ hai.
Form trên UI cố tình không gửi `identifier` để demo được việc bắn nhiều lần.

**"Event đến muộn thì sao?"** Bảng event là append-only và tổng hợp tính lúc đọc, nên một event của
tháng trước gửi lên hôm nay vẫn vào đúng kỳ của nó.

Tiếp theo: [KB-04 — Cấn trừ tiền vé](./04-can-tru-tien-ve.md)
