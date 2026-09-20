# KB-06 — Cổng nhà xe: nhà xe tự xem công nợ

**Thời lượng** ~6 phút · **Màn hình** portal-ui (http://localhost:3100) + Mailpit (http://localhost:58025)
· **Nhà xe** Hoàng Long

## Kể gì

> Tới giờ toàn là màn hình của Vexere. Còn nhà xe thì thấy gì? Họ có một cổng riêng, đăng nhập bằng
> email thanh toán — **không có mật khẩu**, vì kế toán nhà xe không phải người dùng phần mềm chuyên
> nghiệp và mật khẩu là thứ đầu tiên họ quên.

## Bấm gì

| #   | Ở đâu                  | Làm gì                                                                             |
| --- | ---------------------- | ---------------------------------------------------------------------------------- |
| 1   | http://localhost:3100  | Nhập `ketoan@hoanglongasia.vn` → **Gửi link đăng nhập**                            |
| 2   | portal                 | Màn báo "Kiểm tra hộp thư của bạn" — không tiết lộ email có tồn tại hay không      |
| 3   | http://localhost:58025 | Mở Mailpit, mở email **"Đường dẫn đăng nhập cổng nhà xe Vexere"**                  |
| 4   | email                  | Bấm đường dẫn → sang trang xác nhận, bấm **Tiếp tục đăng nhập**                    |
| 5   | portal `/`             | Màn Tổng quan của nhà xe                                                           |
| 6   | portal `/`             | Chỉ vào bốn thẻ: còn phải trả, quá hạn, đến hạn 7 ngày, hạn gần nhất               |
| 7   | portal `/`             | Bảng hoá đơn gần đây — có dòng **Quá hạn · Trễ 21 ngày**                           |
| 8   | portal                 | Bấm vào hoá đơn quá hạn đó                                                         |
| 9   | chi tiết hoá đơn       | Dòng chi tiết: phí nền tảng, phí theo vé, phí ZNS, VAT — đúng như Vexere nhìn thấy |
| 10  | chi tiết hoá đơn       | Kéo xuống thẻ **chuyển khoản**: số tài khoản và **mã VietQR** quét được            |
| 11  | portal `/usage`        | Mức sử dụng — nhà xe tự kiểm tra số vé, khỏi gọi điện hỏi                          |
| 12  | portal `/account`      | Vai trò hiển thị **Kế toán nhà xe**; có nút gửi yêu cầu cho Vexere                 |

## Nói gì

**Ở bước 4:**

> Chú ý: bấm link trong email **chưa** đăng nhập ngay, nó hiện một nút xác nhận. Vì bộ quét email
> của doanh nghiệp tự bấm mọi đường dẫn — nếu link dùng-một-lần bị tiêu thụ bởi con bot quét thư
> thì kế toán mở ra sẽ thấy link đã hết hạn.

**Ở bước 10:**

> Nhà xe quét mã là ra đúng số tiền và đúng nội dung chuyển khoản. Không phải gõ tay, nên không sai
> nội dung — mà sai nội dung chuyển khoản là nguyên nhân số một của công nợ không khớp.

**Ở bước 12:**

> Mỗi nhà xe có hai vai: chủ xe và kế toán. Trình duyệt của nhà xe **không bao giờ giữ API key** —
> lớp server của cổng giữ khoá, trình duyệt chỉ có một cookie.

## Thấy gì

| Chỗ                  | Con số                                  |
| -------------------- | --------------------------------------- |
| Tổng còn phải trả    | 22.275.000 ₫ — 2 hoá đơn                |
| Quá hạn              | 11.137.500 ₫ — 1 hoá đơn, trễ 21 ngày   |
| Đến hạn trong 7 ngày | 11.137.500 ₫                            |
| Lịch sử              | các hoá đơn tháng 5, 6, 7 đã thanh toán |

## Nếu hỏng thì

| Hiện tượng                      | Làm gì                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| Không thấy email trong Mailpit  | `apps/portal-ui/.env.local` thiếu `PINSTRIPE_PORTAL_API_KEY`     |
| Bấm link báo hết hạn            | Link dùng một lần và sống 15 phút — quay lại bước 1 xin link mới |
| Thẻ chuyển khoản không có mã QR | Bốn biến `BANK_TRANSFER_*` trong `.env` đang trống               |
| Cổng đá về trang đăng nhập      | Phiên hết hạn sau 60 phút — đăng nhập lại                        |

## Câu hỏi hay bị hỏi

**"Nhà xe trả tiền ngay trên cổng được không?"** Hiện cổng là **chỉ đọc** cộng với gửi yêu cầu. Chuyển
khoản đi qua ngân hàng bằng mã VietQR, và kế toán Vexere ghi nhận. Đó là chủ ý của giai đoạn này.

**"Nhiều người của một nhà xe dùng chung được không?"** Được — mỗi người một email, mỗi người một
vai. Danh sách quản trị ở drawer Customer bên admin-ui.

Tiếp theo: [KB-07 — Sổ cái và đối soát](./07-so-cai-va-doi-soat.md)
