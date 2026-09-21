# KB-02 — Nhận một nhà xe mới và ký gói

**Thời lượng** ~5 phút · **Màn hình** erp-ui

## Kể gì

> Bây giờ Vexere ký thêm một nhà xe. Tôi sẽ làm trực tiếp, không có gì dựng sẵn. Chú ý một điểm:
> quyền dùng dịch vụ **không** được ghi trong lúc bấm nút — nó đến sau vài giây, do một tiến trình
> nền. Đó là chủ ý, không phải chậm.

## Bấm gì

| #   | Ở đâu                 | Làm gì                                                                                                                  |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | `/customers`          | Bấm **Tạo customer**                                                                                                    |
| 2   | drawer                | Email `ketoan@xekhachdemo.vn` · Tên `Công ty TNHH Xe khách Demo`                                                        |
| 3   | drawer                | Nền tảng đối tác → **Vexere** · Mã tài khoản đối tác → `demo-new`                                                       |
| 4   | drawer                | Bấm **Tạo customer**, toast xanh hiện, dòng mới xuất hiện đầu bảng                                                      |
| 5   | `/subscriptions/list` | Bấm **Tạo subscription**                                                                                                |
| 6   | drawer                | Khách hàng → `Công ty TNHH Xe khách Demo` · Bảng giá → `booking_platform_monthly` · Cách thu tiền → **Cấn trừ tiền vé** |
| 7   | drawer                | Để trống Trial, bấm **Tạo subscription**                                                                                |
| 8   | `/subscriptions/list` | Chỉ vào dòng mới: trạng thái `active`, kỳ hiện tại chạy một tháng kể từ hôm nay                                         |
| 9   | —                     | **Đợi ~5 giây**, bấm F5                                                                                                 |
| 10  | `/subscriptions/list` | Mở drawer thuê bao vừa tạo → tab **Entitlements** đã có quyền dùng "Nền tảng bán vé Vexere"                             |

## Thấy gì

- Bước 4: toast "Đã tạo customer.", bảng tự nạp lại.
- Bước 8: `active` ngay lập tức — phần tiền là đồng bộ.
- Bước 10: entitlement **chỉ xuất hiện sau khi F5** — phần quyền dùng là bất đồng bộ.

## Nói gì ở bước 9–10

> Tại sao quyền dùng lại đến muộn? Vì khi ghi subscription, hệ thống ghi luôn một sự kiện vào cùng
> một transaction. Một worker đọc sự kiện đó rồi mới dựng quyền dùng. Đổi lại: không bao giờ có
> chuyện subscription tồn tại mà sự kiện bị mất, kể cả khi tiến trình chết giữa chừng.

## Nếu hỏng thì

| Hiện tượng                         | Làm gì                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Entitlement vẫn trống sau 2 lần F5 | Worker `domain-event` chưa chạy — nhìn terminal `pnpm dev`, nếu cần thì bỏ qua bước 10 |
| Chọn "Cấn trừ tiền vé" báo lỗi 400 | Khách chưa có mã tài khoản đối tác — quay lại bước 3                                   |
| Email trùng                        | Đổi thành `ketoan+2@xekhachdemo.vn`                                                    |

## Câu hỏi hay bị hỏi

**"Nhà xe tự đăng ký được không?"** Chưa. Đây là back-office của Vexere. Nhà xe chỉ có cổng xem công
nợ — [KB-06](./06-portal-nha-xe.md). Đường tự đăng ký sẽ là API `POST /v1/subscriptions` do hệ thống
bán hàng gọi.

**"`demo-new` là gì?"** Là mã tài khoản của nhà xe đó bên hệ thống Vexere — chỗ giữ doanh thu vé và
số dư ví. VXR ERP không giữ bản sao hai con số đó, nó hỏi sang khi cần thu tiền.

Tiếp theo: [KB-03 — Ghi nhận lượng dùng](./03-usage-va-xem-truoc.md)
