# ADR 0012 — Portal, reporting & reconciliation (Phase 9)

Ngày: 2026-09-16
Trạng thái: Accepted — §7 và phần portal của "Hạn chế đã biết" bị thay thế bởi
[ADR 0026](0026-customer-portal-auth-and-bff.md).

## Bối cảnh

Phase cuối của roadmap. Ba thứ còn lại, và chúng không cùng loại:

- **Reporting** — MRR/ARR/churn, thứ người ta hỏi đầu tiên khi nhìn một billing system.
- **Reconciliation** — RESEARCH.md xếp vào rủi ro #7 và nói thẳng: _"Coi reconciliation là tùy chọn"_
  nằm trong danh sách anti-pattern.
- **Portal** — `apps/portal-ui` từ phase 0 tới giờ vẫn là một `page.tsx` rỗng.

## Quyết định

1. **MRR quy về tháng bằng một hàm thuần.** `buildMonthlyAmount(amount, interval, intervalCount)`
   nhân theo hệ số cố định: ngày ×30, tuần ×30/7, tháng ×1, năm ×1/12, rồi chia cho `intervalCount`.
   Làm tròn về số nguyên minor unit **ngay tại đây**, để cộng hàng trăm dòng không trôi số lẻ.

   Nó thuần nên test được không cần database — và đó là chỗ duy nhất trong reporting có phép tính
   đáng sai.

2. **MRR chỉ đếm gói `active`.** Trial chưa trả tiền nên không phải doanh thu định kỳ; nó được đếm
   riêng ở `trialingSubscriptions`. Gộp trial vào MRR là cách làm con số đẹp lên mà không có tiền
   nào vào.

3. **Mỗi currency một quyển sổ.** Không quy đổi, không cộng chung. Một hệ thống cộng VND với USD
   bằng tỷ giá lúc đọc thì con số hôm nay khác hôm qua mà không ai đổi gì.

4. **Đối soát so hai nguồn theo một khóa chung, và khóa đó phải là thứ cả hai đều biết.**

   Đây là chỗ tôi làm sai lần đầu: tôi **dựng lại** tham chiếu ở phía cổng bằng phép nối chuỗi
   (`invoice_payment:<invoiceId>:<amount>`) rồi so với `externalId` sổ cái ghi ra. Với thanh toán
   đủ một lần thì hai chuỗi trùng nhau; với **thanh toán một phần** thì không, vì sổ ghi số tiền
   _lũy kế_ còn cổng biết số tiền _lần này_. Kết quả: 26 giao dịch bị báo lệch mà thực ra không lệch.

   Sửa đúng cách: sổ cái ghi `payment_intent:<id>` — danh tính thật của giao dịch, do cả hai phía
   cùng biết, không phải một chuỗi được suy ra. Đối soát không bao giờ nên _đoán_ khóa của phía kia.

5. **Đối soát báo cả hai chiều lệch, không chỉ một.**
   - `missing_in_ledger` — cổng nói đã thu, sổ không thấy. Tiền có thể đã vào mà chưa ghi.
   - `missing_in_processor` — sổ có tiền mặt, cổng không biết. Chuyển khoản tay, hoặc ghi nhầm.
   - `amount_mismatch` — cả hai đều có, số khác nhau.

   Và trả về `difference = processorTotal − ledgerTotal` chứ không chỉ một danh sách: một con số
   nhìn là biết có vấn đề hay không, danh sách là để đi tìm.

6. **Refund vào đối soát với số âm.** Nó là tiền đi ra khỏi tài khoản, nên cộng đại số với khoản
   thu là đúng — không cần hai bảng riêng.

7. **Portal render ở server, secret key không bao giờ xuống trình duyệt.** `portal-ui` gọi billing
   API từ Next.js server component với `PINSTRIPE_SECRET_API_KEY`, `cache: 'no-store'`. Trình duyệt
   chỉ nhận HTML đã render.

## Hạn chế đã biết — và cái đầu tiên là nghiêm trọng

**Portal chưa có đăng nhập khách hàng.** Đường dẫn `/customers/<customerId>` không kiểm tra người
xem là ai. **Ai có customerId là xem được hóa đơn của khách đó.** Đây là thứ **không được** đưa ra
internet ở dạng hiện tại.

Chỗ cần làm khi mở thật: đăng nhập bằng magic link qua email, session cookie, và tầng API riêng cho
portal (`/v1/portal/*`) chỉ trả dữ liệu của chính khách đang đăng nhập — chứ không phải dùng secret
key toàn quyền rồi lọc bằng tham số đường dẫn. Trang portal có ghi cảnh báo này ngay trên giao diện.

**Đổi khóa đối soát làm dữ liệu cũ không khớp.** Payment intent tạo trước khi sửa vẫn mang
`externalId` kiểu cũ trong sổ, nên báo cáo 30 ngày hiện vẫn liệt kê chúng là `missing_in_ledger`.
Hệ thống thật xử lý bằng một migration hoặc một mốc cutover; ở đây tôi để nguyên vì đó là dữ liệu
test, nhưng **phải chọn một trong hai trước khi chạy thật**.

**MRR đọc trực tiếp bảng giao dịch.** RESEARCH.md nói MRR/ARR nên đọc từ **read model** riêng. Hiện
tại truy vấn join thẳng `subscription_items × subscriptions × prices`. Đủ nhanh ở quy mô này, nhưng
đây chính là chỗ sẽ phải tách khi số subscription lớn lên — và cấu trúc đã sẵn sàng cho việc đó vì
mọi thứ đi qua `getRevenueSummary`.

**Đối soát mới hai chiều, chưa ba chiều.** So sổ nội bộ ↔ cổng thanh toán. Chiều thứ ba — sao kê ngân
hàng — cần định dạng file của ngân hàng thật, nên chờ PSP thật.

**Chưa có exception workflow.** Lệch thì hiện ra, nhưng chưa ai gán được cho người xử lý, chưa đánh
dấu được "đã đối chiếu tay".

## Kiểm chứng

- 8 unit test cho `buildMonthlyAmount`: bốn chu kỳ, `intervalCount` bội số, luôn trả số nguyên,
  từ chối chu kỳ không lặp.
- 10 integration test: MRR tăng đúng khi thêm gói tháng, gói năm quy về đúng một phần mười hai,
  churn nằm trong [0,1], hai currency không lẫn sổ, window được tôn trọng; đối soát khớp khoản thu,
  **khớp cả khi mới trả một phần** (test hồi quy cho đúng lỗi ở §4), refund không tạo lệch, phát hiện
  tiền mặt không có ở cổng, và `difference` đúng bằng hiệu hai tổng.
- Tổng **105 integration + 66 unit** test xanh. Lint 6/6, typecheck 6/6, `agentkit check` OK.
- Qua HTTP thật: `GET /api/v1/admin/reporting/revenue` trả MRR 356.000.140 VND / 708 gói đang chạy;
  `GET /api/v1/admin/reporting/reconciliation` trả `difference` cùng danh sách lệch.
- Portal chạy thật: khách có hóa đơn `INV-000512` tổng 450.000, đã trả 150.000 → hiển thị còn lại
  **300.000**, khớp với API.
