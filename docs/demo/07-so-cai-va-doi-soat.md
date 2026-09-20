# KB-07 — Sổ cái kế toán và đối soát

**Thời lượng** ~6 phút · **Màn hình** admin-ui · **Khán giả** kế toán, tài chính

## Kể gì

> Phần này dành cho kế toán. Mọi đồng tiền đi qua hệ thống đều để lại một bút toán kép, và sổ là
> **append-only** — không ai sửa, không ai xoá. Ghi sai thì đảo bút toán, và cả hai bút toán đều
> nằm lại trong lịch sử.

## Bấm gì

| #   | Ở đâu                  | Làm gì                                                                           |
| --- | ---------------------- | -------------------------------------------------------------------------------- |
| 1   | `/ledger/accounts`     | Chỉ vào **Tổng nợ = Tổng có = 899.800.000 ₫**                                    |
| 2   | `/ledger/accounts`     | Chỉ vào các dòng `accounts_receivable` — mỗi nhà xe một tài khoản phải thu riêng |
| 3   | `/ledger/accounts`     | Dòng của **Hoàng Long**: số dư **22.275.000 ₫**                                  |
| 4   | —                      | Nói câu đối chiếu ở dưới                                                         |
| 5   | `/ledger/transactions` | Mở tab Transactions, bấm bút toán trên cùng                                      |
| 6   | drawer                 | Hai vế nợ/có bằng nhau, kèm `external_id` trỏ về hoá đơn hoặc lần thu sinh ra nó |
| 7   | drawer                 | Bấm **Đảo bút toán** (nếu muốn diễn phần sửa sai)                                |
| 8   | `/ledger/transactions` | Bút toán đảo xuất hiện, bút toán gốc **vẫn còn**, hai cái liên kết hai chiều     |
| 9   | `/reports`             | Kéo xuống mục **Đối soát 30 ngày**                                               |
| 10  | `/reports`             | Chỉ vào: cổng thanh toán, sổ cái, **chênh lệch 0 ₫**, **0 mục lệch**             |

## Nói gì

**Ở bước 4:**

> Con số này — 22.275.000 — là đúng con số mà kế toán nhà xe Hoàng Long vừa nhìn thấy trên cổng của
> họ. Không phải hai phép tính khác nhau: cổng đọc từ hoá đơn, sổ cái dựng từ bút toán, và chúng
> khớp nhau. Nếu lệch, màn đối soát ở dưới sẽ nói ra.

**Ở bước 7–8:**

> Đây là chỗ khác biệt với một bảng công nợ thường. Không có UPDATE, không có DELETE. Bút toán sai
> vẫn nằm đó, kèm bút toán đảo nó. Kiểm toán đọc được toàn bộ lịch sử chứ không đọc được trạng thái
> cuối cùng đã bị sửa.

**Ở bước 10:**

> Đây là câu hỏi mà mọi hệ thống thu tiền phải trả lời hằng ngày: tiền cổng thanh toán báo về có
> khớp tiền trên sổ không. Hệ thống tự đối chiếu từng giao dịch. Lệch một đồng là hiện thành một
> dòng ở bảng dưới, không im lặng.

## Thấy gì

| Chỗ                     | Con số                                           |
| ----------------------- | ------------------------------------------------ |
| Tổng nợ / Tổng có       | bằng nhau — **899.800.000 ₫**                    |
| Phải thu của Hoàng Long | **22.275.000 ₫**, khớp cổng nhà xe               |
| Đối soát: chênh lệch    | **0 ₫**                                          |
| Đối soát: mục lệch      | **0** — "Không có trường hợp lệch nào trong kỳ." |

## Nếu hỏng thì

| Hiện tượng          | Thật ra là                                                                           |
| ------------------- | ------------------------------------------------------------------------------------ |
| Có mục lệch         | Nếu bạn vừa đảo một bút toán ở bước 7 thì đó là hệ quả thật — nói rõ, đừng giấu      |
| Tổng nợ ≠ tổng có   | Không xảy ra trừ khi dữ liệu bị sửa tay ngoài hệ thống                               |
| Đối soát trống trơn | Kỳ 30 ngày chưa có giao dịch qua cổng thanh toán nào — bình thường nếu mới seed xong |

**Mẹo:** nếu định diễn bước 7 (đảo bút toán), hãy làm **sau** bước 10, để màn đối soát còn sạch lúc
trình bày.

## Câu hỏi hay bị hỏi

**"Tiền cấn trừ vé nằm ở đâu trong sổ?"** Ở `ticket_offset_clearing`, không ở `cash`. Nó là tiền đã
trừ nhưng chưa về tài khoản ngân hàng, và tách riêng để biết còn bao nhiêu chờ đối soát với Vexere.

**"Đối soát có quét phần cấn trừ vé không?"** Chưa. Màn này đối chiếu đường cổng thanh toán. Đường
đối tác có bản ghi `collection_attempts` riêng cho từng lần thu.

**"Báo cáo xuất ra được không?"** Dữ liệu có sẵn qua API; màn xuất file chưa làm.

Quay lại: [Danh mục kịch bản](./README.md)
