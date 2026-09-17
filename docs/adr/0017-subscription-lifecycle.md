# ADR 0017 — Vòng đời subscription

**Trạng thái.** Đã chốt, phase 16. Nối tiếp [ADR 0013](0013-arrears-proration.md) ở chỗ cửa sổ tính
tiền, và thay phần "`replaceSubscriptionItems` churn id item" mà 0013 cố ý để lại.

## Bối cảnh

Trước phase 16, `advanceSubscriptions` chỉ có đúng một caller là `TestClockService`. Một subscription
không gắn test clock **không bao giờ roll kỳ**: billing run chỉ draft hoá đơn cho kỳ đã đóng, còn kỳ
thì đứng yên mãi mãi. `past_due` và `unpaid` có trong enum nhưng không ai ghi vào, nên luật
`unpaid → blocked` của entitlement là code chết. `paused`, `cancelAt`, `cancellationDetails`,
`trialSettings` chưa tồn tại, và `defaultPaymentMethod` là một khoá trong `metadata` với fallback
`pm_card_ok` hardcode trong dunning.

## Quyết định

### 1. Cửa sổ tính tiền tách khỏi bảng item

`subscription_items` chỉ còn giữ **danh tính**: id, price hiện tại, quantity hiện tại, taxRates,
metadata, `deleted_at`. Ba cột `billed_from` / `billed_through` / `invoiced_through` chuyển sang bảng
mới `subscription_item_changes`, mỗi hàng là một cửa sổ với `price_id` và `quantity` của riêng nó.

Đổi quantity vì thế **giữ nguyên id item**: đóng cửa sổ đang mở tại `boundary`, mở một cửa sổ mới từ
`boundary`. Rating đọc cửa sổ chứ không đọc item, nên một item có thể có nhiều cửa sổ trong cùng một
kỳ mà không cần một id thứ hai. Đây chính là lối thoát mà ADR 0013 đã gọi tên.

`invoice_line_items` mang thêm `subscription_item_change_id`, vì mark-invoiced và reopen-on-void phải
trỏ đúng cửa sổ đã xuất hoá đơn chứ không phải mọi cửa sổ của item.

`updateSubscription` khớp item theo `id` khi payload có, còn không thì khớp theo `priceId`; item
không khớp được là item bị gỡ. Bề mặt `/v1/subscription_items` (`GET` / `POST` / `DELETE`) dùng đúng
cỗ máy đó, và từ chối xoá item cuối cùng — muốn dừng hẳn thì huỷ subscription.

### 2. Rating bám vào kỳ của hoá đơn, không bám vào kỳ hiện tại của subscription

Billing run giờ vừa draft vừa roll kỳ, nên tại lúc finalize, subscription đã sang kỳ sau. Trước đây
`collectSubscriptionLines` ném `ConflictError` đúng trong tình huống này.

`rateInvoicePeriod(subscriptionId, periodStart, periodEnd)` nhận kỳ của **hoá đơn**. Một hoá đơn phát
hành muộn vì thế vẫn rate đúng kỳ mà nó ghi, và thứ tự draft → advance → finalize không còn tự đá vào
chân mình.

### 3. Billing run là cả đường ống, không chỉ là bước draft

```
ensure draft (kỳ vừa đóng) → advance / cancelAt / resume / expire → auto-advance (finalize) → thu
```

`ensure draft` đứng trước `advance` vì đây là bill in arrears: kỳ vừa đóng phải có hoá đơn trước khi
subscription bước sang kỳ mới. `rollPeriod` cũng tự gọi `ensureBillableDraft`, nên một cú roll do test
clock kích hoạt không làm mất hoá đơn của kỳ vừa đóng.

Trạng thái được bill là `active`, `past_due`, `paused`. `trialing` **không** bill: kỳ dùng thử không
được tính tiền, và kỳ sau bắt đầu đúng ở `trialEnd`.

### 4. `now` đi qua một helper dùng chung

`ClockService.resolveNow(testClockId)` là một chỗ duy nhất trả lời "bây giờ là mấy giờ", cộng ba lối
vào tiện: theo customer, theo subscription, theo invoice. Invoice, dunning và billing run đều dùng
nó, nên test clock điều khiển cả đường ống chứ không riêng `SubscriptionService`.

Hai chỗ có sắc thái riêng:

- **Quét theo shard** dùng `runAt` của job cho subscription không gắn clock, và dùng giờ đóng băng cho
  subscription có clock. Nếu lấy đồng hồ thật cho mọi hàng thì một shard không bao giờ mô phỏng được,
  còn nếu lấy `runAt` cho mọi hàng thì một subscription đang bị đóng băng sẽ bị kéo theo.
- **Dunning** lấy `max(runAt, giờ của invoice)`. Một lần thu không xảy ra trước giờ chạy của nó; còn
  khi test clock đã đi trước, clock thắng.

### 5. `past_due`, `unpaid`, `incomplete` do dunning ghi

| Sự kiện                                            | Trạng thái                      |
| -------------------------------------------------- | ------------------------------- |
| thu hỏng, subscription chưa từng thu được đồng nào | `incomplete`                    |
| thu hỏng, đã từng thu được (`chargedThroughDate`)  | `past_due`                      |
| hết lịch retry, hoá đơn thành `uncollectible`      | `unpaid`                        |
| thu được                                           | `active` + `chargedThroughDate` |
| `incomplete` quá 23 giờ                            | `incomplete_expired`            |

**`past_due` không chặn entitlement.** Đây là lựa chọn bị ép phải chốt: giữ dịch vụ trong suốt lịch
dunning (1/3/5/7 ngày), và chỉ chặn khi sang `unpaid`. Chặn ngay lúc `past_due` biến một lần thẻ hết
hạn thành một lần mất dịch vụ, còn `unpaid` là lúc hệ thống đã thôi đòi. `incomplete` chặn ngay vì
chưa có đồng nào vào, `incomplete_expired` và `canceled` thì thu hồi hẳn.

### 6. `paused` là một trạng thái thật

`pauseCollection { behavior, resumesAt }` với ba behavior của Stripe. Kỳ vẫn roll và hoá đơn vẫn được
tạo; behavior quyết định số phận của bản nháp: `keep_as_draft` tắt `autoAdvance`, `mark_uncollectible`
finalize rồi đánh dấu không thu được, `void` huỷ luôn bản nháp.

Entitlement của `paused` là `active`: tạm dừng **thu tiền** không phải tạm dừng dịch vụ. `resumesAt`
tới thì billing run tự mở lại.

### 7. `trialSettings.endBehavior.missingPaymentMethod`

Hết trial mà `collectionMethod = charge_automatically` và không có payment method nào (trên
subscription rồi tới customer): `create_invoice` (mặc định) cứ bill như thường, `cancel` huỷ với
`cancellationDetails.reason = payment_failed`, `pause` chuyển sang `paused` + `keep_as_draft`.

### 8. `defaultPaymentMethod` là cột thật

Có trên cả `customers` lẫn `subscriptions`; dunning đọc subscription trước, rồi tới customer, và
**không** còn fallback `pm_card_ok`. Không có payment method thì lần thu đó tính là hỏng — một lần thu
không có thẻ là một lần thu hỏng, không phải một lần thu thành công trong im lặng. Phase 18 sẽ biến
cột text này thành khoá ngoại thật.

## Hệ quả

- `subscription_items` mất ba cột; mọi thứ đọc cửa sổ phải đi qua `subscription_item_changes`.
  Migration `0022` backfill một cửa sổ cho mỗi item đang có.
- `SUBSCRIPTION_TRANSITIONS` rộng ra: thêm `paused`, `incomplete_expired`, và cho phép
  `active → incomplete` (vì bill in arrears, lần thu đầu tiên rơi vào cuối kỳ đầu chứ không phải lúc
  tạo).
- Billing run gọi cả dunning shard, nên hai workflow có thể chạm cùng một hoá đơn. `nextAttemptAt`
  là thứ chặn thu trùng, và nó đã có từ phase 8.
- Phase 17 (bill in advance) sẽ đảo lại chỗ `ensure draft` đứng trước `advance`.
