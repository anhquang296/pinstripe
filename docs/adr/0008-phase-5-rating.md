# ADR 0008 — Rating (Phase 5)

Ngày: 2026-09-16
Trạng thái: Accepted

## Bối cảnh

RESEARCH.md §1 tách **rating** (áp giá lên metric để ra số tiền) khỏi metering (phase 4) và khỏi
invoicing (phase 6). §"quyết định rủi ro cao" gọi tên rủi ro số 6: _"Proration mid-cycle → engine
rating thuần (pure function), test property-based, tách entitlement khỏi thời điểm bill."_

Phase 5 dựng đúng engine đó. Nó **không** phát hành hóa đơn, không ghi sổ, không thu tiền.

## Quyết định

1. **Engine là hàm thuần, không I/O, không đồng hồ.** Toàn bộ phép tính giá nằm trong
   `utils/rating.ts`: không đọc DB, không gọi `clock`, không `Date.now()`. Mọi thứ nó cần đi vào
   qua tham số — giá, số lượng, mốc thời gian của kỳ.

   Đây không phải sở thích kiến trúc: nó là điều kiện để **tính lại lịch sử**. Khi kế toán hỏi "hóa
   đơn tháng 3 sao ra số này", câu trả lời phải dựng lại được từ dữ liệu tháng 3, không phụ thuộc
   vào trạng thái hệ thống hôm nay. Một engine đọc DB bên trong thì không trả lời được câu đó.

   Hệ quả: `RatingService` chỉ làm một việc — gom input rồi gọi engine. Mọi nhánh tính toán nằm
   trong hàm thuần, và test của nó không cần database.

2. **Tiền luôn là `Money`, không bao giờ là `number` trong lúc tính.** Engine nhận và trả `Money`;
   chỉ khi ra tới wire mới thành integer minor unit. Rounding policy là **một hằng số duy nhất**
   (`HALF_UP`) dùng cho mọi phép nhân trong engine — không có chỗ nào tự chọn cách làm tròn riêng.

3. **Graduated vs volume là hai phép tính khác nhau, không phải hai tham số.**
   - _Graduated_: mỗi bậc tính phần số lượng rơi vào bậc đó. 1.500 đơn vị với bậc (≤1000 @10,
     ∞ @4) = 1000×10 + 500×4 = 12.000.
   - _Volume_: toàn bộ số lượng tính theo bậc mà nó rơi vào. Cùng dữ liệu = 1500×4 = 6.000.

   `flatAmount` của một bậc **chỉ tính khi số lượng thật sự chạm vào bậc đó**. Số lượng 0 ra 0 đồng,
   không thu phí bậc 1.

   **Điểm này cần đối chiếu với Stripe trước khi chạy thật.** Stripe được cho là vẫn thu `flat_amount`
   của bậc đầu ở mức usage 0 — đó là cách nhiều nơi mô hình hóa "phí nền + usage". Tôi chọn hướng
   ngược lại vì thu tiền một khách không dùng gì là thứ phải cố ý làm, không phải thứ rơi ra từ cấu
   hình bậc giá. Ai cần phí nền thì tạo một licensed price riêng — nó hiện rõ trên hóa đơn thay vì
   nấp trong bậc 1.

4. **Proration là một hệ số thời gian, không phải một loại giá.** Line có `usageStart`/`usageEnd`
   nằm trong `[periodStart, periodEnd]` thì nhân theo tỷ lệ `usedMs / periodMs`. Không có, hệ số là 1.
   Credit (hoàn phần chưa dùng) là cùng phép tính đó với `isCredit: true` → số âm.

   Nhờ vậy nâng cấp giữa kỳ chỉ là **hai line cộng lại**: credit phần còn lại của gói cũ + charge
   phần còn lại của gói mới. Không có nhánh "upgrade" riêng nào trong code.

5. **Price phải trỏ vào meter.** Trước phase này, `usageType = 'metered'` không có cách nào nói nó
   đo cái gì — metered price tồn tại trên giấy nhưng không rate được. Thêm `prices.meter_id` + check
   constraint hai chiều: metered thì **bắt buộc** có meter, không metered thì **cấm** có.

   Ràng buộc ở tầng DB chứ không chỉ tầng service, vì đây là loại sai chỉ lộ ra lúc phát hành hóa đơn
   — quá muộn.

6. **`GET /v1/invoices/upcoming` trả kết quả rating, không phải hóa đơn.** Object là
   `rated_invoice`: không số hóa đơn, không trạng thái, không lưu. Hỏi hai lần có thể ra hai số khác
   nhau nếu usage thay đổi ở giữa — **đó là đúng**, vì chưa có gì được chốt. Việc đóng băng con số
   là nhiệm vụ của phase 6.

7. **Item thêm giữa kỳ được prorate theo `createdAt` của chính nó.** Dữ liệu này đã có sẵn, nên
   proration không phải tính năng chờ phase sau mới bật.

## Không làm trong phase này

- **Thuế, coupon, credit note.** Mỗi thứ đều đổi cách tính tổng; gắn vào trước khi có hóa đơn thật
  thì không có gì để đối chiếu xem đúng hay sai.
- **Lưu kết quả rating.** Cố ý. Lưu một con số tiền không gắn với hóa đơn là tạo ra đúng thứ ADR
  0007 vừa tránh — một giá trị sống song song với nguồn sự thật và có quyền lệch.
- **Preview một thay đổi chưa xảy ra** (Stripe: `subscription_proration_date`). Engine đã tính được,
  nhưng chưa có consumer nào cần, nên chưa mở ra API.

## Hạn chế đã biết

**Meter event không theo test clock.** `ingestMeterEvent` lấy `timestamp` từ đồng hồ thật khi caller
không truyền vào, kể cả với customer đang gắn test clock. Phase 4 cố ý làm ingest rẻ — tra test clock
mỗi event là thêm một lượt đọc trên đường nóng nhất hệ thống. Hệ quả: kịch bản mô phỏng thời gian
phải **tự truyền `timestamp`**. Test integration của phase này làm đúng vậy. Nếu sau này cần, chỗ sửa
là ingest batch, không phải ingest lẻ.

## Kiểm chứng

- 27 unit test cho engine thuần: per_unit, transformQuantity (up/down, dưới một gói), graduated
  (5 mốc biên), volume (4 mốc biên), flatAmount, proration nửa kỳ, credit, lệch currency, số lượng âm.
- 5 integration test: licensed × quantity, metered đọc từ usage thật, metered không usage ra 0,
  và hai chiều của ràng buộc meter.
- Qua HTTP thật: subscription 2 line (licensed 2×500.000 + graduated metered), bắn 1.500 event →
  tổng **1.012.000 VND**, đúng 1000×10 + 500×4 = 12.000 cho phần usage.
- Cùng con số đó hiện trên màn hình Rating của admin UI.
