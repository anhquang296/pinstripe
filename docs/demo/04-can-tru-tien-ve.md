# KB-04 ⭐ — Thu tiền bằng cách cấn trừ doanh thu vé

**Thời lượng** ~6 phút · **Màn hình** erp-ui · **Nhà xe** Phương Trang FUTA

Đây là kịch bản quan trọng nhất. Nó là điểm khác biệt của VXR ERP so với một hệ thống billing
thông thường: kênh thu tiền chính **không phải thẻ**.

## Kể gì

> Nhà xe không quẹt thẻ để trả tiền Vexere. Tiền đã nằm sẵn ở Vexere rồi — đó là doanh thu bán vé
> của chính nhà xe đó. Nên thu tiền ở đây nghĩa là **cấn trừ vào doanh thu vé**. Tôi sẽ phát hành
> hoá đơn tháng này của Phương Trang, rồi để hệ thống tự đi thu. Không ai bấm nút "thu tiền".

## Bấm gì

| #   | Ở đâu                          | Làm gì                                                                                         |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | `/billing/invoices/draft`      | Ba bản nháp của kỳ này. Bấm dòng **Phương Trang FUTA**                                         |
| 2   | drawer                         | Chỉ vào **Cách thu tiền: Cấn trừ tiền vé** và **Kỳ: 31/08 → 30/09**                            |
| 3   | drawer                         | Chỉ vào Tổng tiền đang là **0 ₫** — nói câu ở dưới                                             |
| 4   | drawer                         | Bấm **Phát hành**                                                                              |
| 5   | drawer                         | Số hoá đơn xuất hiện, trạng thái `open`, tổng **72.682.500 ₫**, còn lại đúng bằng tổng         |
| 6   | —                              | **Chờ tối đa 60 giây.** Trong lúc chờ, mở tab Mailpit: email hoá đơn đã gửi cho kế toán nhà xe |
| 7   | `/billing/invoices/paid`       | F5 — hoá đơn vừa rồi đã sang **`paid`**, không ai bấm gì thêm                                  |
| 8   | `/billing/ledger/transactions` | Dòng trên cùng: bút toán `DEBIT ticket_offset_clearing / CREDIT accounts_receivable`           |

## Nói gì

**Ở bước 3:**

> Bản nháp chưa có số tiền, vì số tiền chỉ đóng băng lúc phát hành. Trước đó nó vẫn đang được tính
> lại từ dữ liệu sống — chúng ta vừa xem chính con số đó ở màn trước.

**Ở bước 6:**

> Không có nút "thu tiền" nào cả. Khi hoá đơn được phát hành, hệ thống đặt một lịch hẹn thu. Một
> tiến trình nền chạy mỗi phút, thấy hoá đơn tới hạn thì gọi sang Vexere xin cấn trừ vào doanh thu
> vé của nhà xe này.

**Ở bước 8:**

> Tiền không vào thẳng "tiền mặt". Nó vào một tài khoản trung gian — `ticket_offset_clearing` —
> nghĩa là "khoản sẽ nhận về khi đối soát doanh thu vé". Kế toán nhìn vào là biết ngay còn bao nhiêu
> chưa về tài khoản thật.

## Thấy gì

| Chỗ             | Con số                                                 |
| --------------- | ------------------------------------------------------ |
| Tổng hoá đơn    | **72.682.500 ₫** (66.075.000 ₫ + VAT 10%)              |
| Thời gian thu   | ≤ 60 giây sau khi phát hành                            |
| Trạng thái cuối | `paid`, đã trả đủ                                      |
| Bút toán        | `ticket_offset_clearing` nợ / `accounts_receivable` có |

## Nếu hỏng thì

| Hiện tượng                           | Thật ra là                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Chờ quá 90 giây vẫn `open`           | Worker `dunning` chưa chạy. Nhìn terminal `pnpm dev`, phần màu đỏ `dunning`                 |
| Trừ được **0 đ**, hoá đơn vẫn `open` | `MOCK_VEXERE_BALANCES` chưa vào env, **hoặc** chưa khởi động lại `pnpm dev` sau khi sửa env |
| Không có bút toán clearing           | Hoá đơn chưa được thu — xem hai dòng trên                                                   |

Nếu bí: chuyển sang [KB-05](./05-tru-vi-va-con-no.md) rồi quay lại, hoá đơn thường đã `paid` lúc đó.

## Câu hỏi hay bị hỏi

**"Gọi sang Vexere mà nửa chừng mất mạng thì sao?"** Mỗi lần thu là một bản ghi `collection_attempts`
được **commit trước khi gọi**, mang một khoá idempotency. Lần thử lại dùng đúng khoá đó, nên Vexere
trả lại kết quả cũ chứ không trừ lần hai.

**"Nhà xe không đủ doanh thu vé thì sao?"** Đó chính là [KB-05](./05-tru-vi-va-con-no.md).

**"Tại sao không trừ thẳng vào ví trong VXR ERP?"** Vì số dư thật nằm ở Vexere. Giữ một bản sao ở
đây là tạo ra một con số chắc chắn sẽ lệch.

Tiếp theo: [KB-05 — Trừ ví và còn nợ](./05-tru-vi-va-con-no.md)
