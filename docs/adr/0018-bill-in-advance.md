# ADR 0018 — Bill in advance

**Trạng thái.** Đã chốt, phase 17. Đảo lại quyết định trung tâm của
[ADR 0013](0013-arrears-proration.md), và dựng trên vòng đời kỳ của
[ADR 0017](0017-subscription-lifecycle.md).

## Bối cảnh

Đây là điểm lệch hành vi lớn nhất giữa pinstripe và Stripe, và nó không phải một tính năng thiếu — nó
là một lựa chọn mô hình. ADR 0013 chốt bill **in arrears**: hoá đơn phát ở cuối kỳ, phủ kỳ vừa kết
thúc. Stripe bill **in advance**: hoá đơn phát ở đầu kỳ, phủ kỳ sắp chạy.

Hệ quả của việc lệch: `billingReason = subscription_create` là member không ai ghi vào,
`RatingLine.isCredit` là hook không producer, và một khách đổi gói giữa kỳ **không bao giờ** thấy một
dòng hoàn tiền — thứ mà bất kỳ ai đọc code này để hiểu Stripe đều đang đi tìm.

Mục tiêu số một của dự án là hiểu Stripe vận hành thế nào, nên phương án "ở lại arrears và viết một
ADR nói đây là lệch có chủ ý" bị loại.

## Quyết định

### 1. `billingMode` là thuộc tính của **subscription**

Cột `billing_mode` trên `subscriptions`, `NOT NULL DEFAULT 'advance'`, đặt được lúc tạo và bất biến
sau đó.

**Đã cân nhắc và loại:**

- **Thuộc tính của price.** Một subscription khi đó có thể mang hai price khác mode, và không có câu
  trả lời nào cho "kỳ này phát hoá đơn lúc nào". Mốc phát hoá đơn là thuộc tính của **hợp đồng**, không
  phải của dòng hàng.
- **Thuộc tính của cả hệ (env).** Đổi một biến môi trường thì mọi subscription đang chạy đổi cách tính
  giữa kỳ, và không có đường di trú nào từng hàng một.
- **Đổi được sau khi tạo.** Chuyển advance → arrears giữa kỳ để lại một kỳ đã thu mà không ai định
  nghĩa được nên hoàn hay không. Muốn đổi thì huỷ rồi tạo lại.

`arrears` ở lại như một chế độ song song đầy đủ, không phải một cờ tương thích: nó là mô hình đúng cho
một hợp đồng thuần usage, và mọi test mô tả hành vi arrears đều nói mode của nó ra thành lời.

### 2. Item metered luôn bill in arrears, kể cả trong subscription `advance`

Usage chỉ đo được sau khi nó xảy ra — Stripe cũng vậy. Nên một hoá đơn chu kỳ của subscription
`advance` mang **hai cửa sổ**:

| Nhóm dòng                                  | Cửa sổ                                      | Ý nghĩa                |
| ------------------------------------------ | ------------------------------------------- | ---------------------- |
| licensed (`buildUpfrontLines`)             | `[periodStart, periodEnd]`                  | kỳ sắp chạy, thu trước |
| metered + proration (`buildTrailingLines`) | `[regressPeriod(periodStart), periodStart]` | kỳ vừa đóng, thu sau   |

Cửa sổ trailing **không** cần một cột mới trên `invoices`: nó suy ra được từ `periodStart` của chính
hoá đơn cộng interval của subscription (`regressPeriod`). Một cột `usage_period_start` sẽ là sự thật
thứ hai về cùng một mốc.

`regressPeriod` cho tháng có thể lùi **sớm hơn** mốc thật khi anchor rơi vào ngày 29–31
(`advancePeriod(31/01) = 28/02`, lùi lại ra `28/01`). Không sao: `invoiced_through` mới là thứ chặn
thu trùng, và nó liên tục. Cửa sổ rộng hơn một chút bị chính nó cắt về đúng mốc.

### 3. Proration ở advance là một **credit âm** cộng một **charge dương**

Khách đã trả trọn kỳ, nên đổi giữa kỳ phải hoàn phần chưa dùng của giá cũ rồi thu phần còn lại của
giá mới. Đây là producer đầu tiên của `RatingLine.isCredit`, thứ mà ADR 0013 để lại.

Điều kiện sinh credit đọc thẳng từ ba cột cửa sổ của ADR 0013, không thêm cột nào:

```
credit window = [billed_through, invoiced_through] ∩ [periodStart, periodEnd]
                khi billed_through < invoiced_through
```

`invoiced_through > billed_through` nghĩa là "đã thu tới mốc này nhưng cửa sổ đã đóng sớm hơn" — đúng
định nghĩa của phần trả thừa. Ở arrears bất đẳng thức ấy không bao giờ đúng, nên cùng một engine chạy
được cả hai mode.

Sau khi credit được xuất hoá đơn, `invoiced_through` hạ về `billed_through`
(`markSubscriptionItemChangesInvoiced`) — cửa sổ khi đó không còn nợ ai và cũng không còn được hoàn
lần hai.

### 4. `invoiced_through` trở thành thứ chặn thu trùng, và nó có trần

Ở advance, hoá đơn chu kỳ được finalize **ngay tại lúc roll** chứ không chờ `finalizeDelayMs`. Lý do
là bản thân `invoiced_through` chỉ được ghi lúc finalize: nếu bản nháp còn treo mà khách đổi gói, lần
đổi ấy sẽ được đọc như arrears và không sinh credit.

Marking dùng một biểu thức duy nhất, không phụ thuộc thứ tự gọi:

```sql
invoiced_through = least(
  coalesce(billed_through, 'infinity'),
  greatest(coalesce(invoiced_through, $through), $through)
)
```

`greatest` để hai cửa sổ của cùng một hoá đơn không kéo nhau xuống; `least(billed_through)` để một cửa
sổ đã đóng không bao giờ mang `invoiced_through` vượt quá mốc đóng của nó — nếu vượt, lần rate sau sẽ
thấy một khoản trả thừa không có thật và hoàn tiền cho nó.

### 5. `always_invoice` không còn bị giới hạn ở cửa sổ đã đóng

ADR 0013 §3 giới hạn hoá đơn tức thì ở các cửa sổ đã đóng, vì ở arrears thu trước phần còn lại là
"bill in advance trá hình". Ở advance đó chính là điều đúng: hoá đơn swap mang credit của giá cũ và
charge trọn phần còn lại của giá mới. Giới hạn ấy vì thế chỉ còn hiệu lực trong mode `arrears`.

### 6. `GET /v1/invoices/upcoming` đổi nghĩa

Từ "kỳ đang chạy sẽ tính bao nhiêu" thành "kỳ tới sẽ thu bao nhiêu": ở advance nó rate
`[currentPeriodEnd, currentPeriodEnd + interval]`, nên nó trả về đúng ba thứ hoá đơn kế tiếp sẽ mang —
tiền kỳ tới, usage kỳ này, và mọi proration chưa xuất hoá đơn. Ở arrears nó giữ nguyên nghĩa cũ.

Dòng trả về mang thêm `isCredit`, vì một số âm không tự nói được nó là hoàn tiền hay là một khoản
chỉnh giá.

### 7. Huỷ cuối kỳ đóng cửa sổ trước khi phát hoá đơn cuối

Ở arrears, hoá đơn kỳ vừa đóng được draft trước khi roll. Ở advance thứ tự ngược lại, nên một
subscription huỷ cuối kỳ vẫn còn usage của kỳ ấy chưa ai thu. `issueTrailingInvoice` đóng mọi cửa sổ
tại `endedAt` rồi phát một hoá đơn cho kỳ-lẽ-ra-tiếp-theo: nhóm upfront rỗng (cửa sổ đã đóng), nhóm
trailing chính là usage cần thu. Không có dòng nào thì không có hoá đơn nào.

## Hệ quả

- `ensureDraftInvoice` nhận kỳ ra thành tham số thay vì đọc `currentPeriodStart` của subscription —
  hoá đơn trailing phủ một kỳ không phải kỳ hiện tại của ai cả.
- `BillingRunService` bỏ qua bước draft cho subscription `advance`; vòng đời tự lo, vì ở advance hoá
  đơn thuộc về kỳ **sau** cú roll.
- `SUBSCRIPTION_TRANSITIONS` cho phép `active → incomplete` từ phase 16 vì lần thu đầu rơi vào cuối kỳ
  đầu. Ở advance lần thu đầu rơi vào lúc tạo, nên nhánh ấy chạm sớm hơn nhiều.
- Test mô tả hành vi arrears (`rating`, phần lớn `invoices`, `reporting`, hai test thuế, hai test
  discount, một test lifecycle) nay nói `billingMode: 'arrears'` ra thành lời. Đó là tài liệu, không
  phải cờ tương thích.

## Giới hạn đã biết

- **Huỷ ngay giữa kỳ không hoàn tiền.** Cửa sổ không bị đóng tại `canceledAt`, nên phần đã trả cho
  quãng chưa dùng ở lại với nhà cung cấp — giống Stripe mặc định. Muốn hoàn thì phát credit note.
- **Credit lớn hơn charge thì hoá đơn `always_invoice` không được phát.** `total <= 0` vẫn là điều
  kiện chặn, nên một lần hạ gói để lại credit treo cho hoá đơn kỳ sau hấp thụ. Một hoá đơn tổng âm
  chạy được qua `assembleInvoiceTotals` (nó rơi vào `endingBalance`), nhưng dunning và ledger chưa
  được đọc lại dưới giả thiết đó.
- **Đổi interval giữa các kỳ làm cửa sổ trailing lệch.** `regressPeriod` dùng interval hiện tại của
  subscription, nên một lần đổi từ tháng sang năm khiến cửa sổ usage của kỳ giao thời rộng hơn thật.
  `invoiced_through` chặn thu trùng nên không mất tiền, nhưng `periodStart` in trên dòng usage sẽ sớm
  hơn mốc thật.
- **Thuế trên dòng credit làm tròn từng dòng**, nên tổng thuế của một lần swap có thể lệch một đơn vị
  so với việc tính thuế trên hiệu số. Không thêm dòng điều chỉnh.
- **Hoá đơn `subscription_create` được finalize ngay trong một transaction khác** với transaction tạo
  subscription. Tạo được subscription mà phát hoá đơn hỏng thì subscription vẫn tồn tại và lỗi ném ra
  cho caller.

## Đọc tiếp

- [ADR 0013 — Proration theo arrears](0013-arrears-proration.md) — ba cột cửa sổ, và mô hình mà ADR này đảo lại
- [ADR 0017 — Vòng đời subscription](0017-subscription-lifecycle.md) — `subscription_item_changes` và vòng roll kỳ
- [technique 06 — Proration](../technique/06-proration.md) — cơ chế cắt lát, có ví dụ kèm số
- [flow 08 — Billing run](../flows/08-billing-run.md) — thứ tự draft / advance / finalize / thu
