# ADR 0013 — Proration theo arrears, và `prorationBehavior`

Ngày: 2026-09-17. Trạng thái: đã triển khai.

## Bối cảnh

`updateSubscription` mint id mới cho mọi item rồi soft-delete cả bộ cũ. `findSubscriptionItems` lọc
`deleted_at is null`, nên item bị thay **biến mất khỏi rating**. Hệ bill in arrears — hoá đơn phủ kỳ
vừa kết thúc — nên hậu quả là **tính thiếu**: khách dùng gói cũ nửa kỳ rồi đổi, nửa kỳ đó không bị
tính đồng nào. Item mới thì đã prorate đúng nhờ `createdAt > periodStart`; chỉ thiếu vế bên kia.

Cùng lúc, API không có cách nào nói "đổi giá nhưng đừng cắt lát" — thứ mà một lần tăng giá cho toàn
bộ khách hàng cần.

## Quyết định

### 1. Item bị gỡ sinh dòng **dương**, không phải credit âm

Stripe bill in advance: khách đã trả trọn kỳ, nên đổi giữa kỳ phải **hoàn** phần chưa dùng của giá cũ
rồi thu phần còn lại của giá mới. Ở arrears chưa ai trả gì, nên đúng nghiệp vụ là **thu cả hai lát**.

`RatingLine.isCredit` vẫn còn trong engine và vẫn có unit test, nhưng **không có producer nào trong
code sản phẩm**. Nó là hook cho một chế độ advance sau này, không phải code chết.

### 2. Ba cột cửa sổ trên `subscription_items`

| Cột                | Nghĩa                                   |
| ------------------ | --------------------------------------- |
| `billed_from`      | mốc item bắt đầu phát sinh tiền         |
| `billed_through`   | mốc ngừng; `NULL` = chưa ngừng          |
| `invoiced_through` | phần cửa sổ tới mốc này đã xuất hoá đơn |

`prorationBehavior` là tham số của **lần thay đổi**, không phải thuộc tính của product / price /
subscription. Nhưng rating chạy trễ (lúc finalize) nên ý định phải vật chất hoá xuống row. Một lần gỡ
với `none` ghi `billed_through = currentPeriodStart` — mệnh đề đúng về một mốc thật, không phải
sentinel, và nó tự loại item khỏi kỳ này mà không bóp méo mô tả của các kỳ trước.

Bất biến ép ở tầng DB: `deleted_at IS NULL` ⟺ `billed_through IS NULL`, và `invoiced_through` chỉ
tồn tại khi cửa sổ đã đóng.

**Đã cân nhắc và loại:**

- Một cột enum `proration_behavior` trên item — một row tham gia hai lần đổi (tạo và gỡ); ghi lần gỡ
  sẽ xoá mất sự thật của lần tạo.
- Một cột trên `subscriptions` — bị lần update sau ghi đè, và không mô tả nổi row đã bị gỡ.
- Một bảng `subscription_item_changes` riêng — đúng sách vở, và là **lối thoát** nếu sau này cần
  change history hoặc `subscription_proration_date` kiểu Stripe. Hôm nay không consumer nào cần nó.
- Suy "đã xuất hoá đơn" bằng join `invoice_line_items.subscription_item_id` — cần index mới nên
  không miễn migration, và kéo invoice aggregate vào `RatingService`, vốn là endpoint preview công
  khai.

### 3. `always_invoice` chỉ xuất hoá đơn cho cửa sổ đã đóng

Tại mốc swap, thứ duy nhất đã thực sự tiêu thụ là lát đã trôi qua. Thu luôn phần còn lại của item
mới là bill in advance trá hình, và nó phá vỡ bất biến `[periodStart, periodEnd]` mà
`ensureDraftInvoice` và guard của `finalizeInvoice` dựa vào.

Hoá đơn tức thì quét **mọi** cửa sổ đã đóng và chưa xuất hoá đơn trong kỳ, không chỉ cửa sổ do lần
gọi này đóng — một lần swap `create_prorations` trước đó cũng để lại lát đã tiêu thụ chưa bill.

### 4. `billing_reason` và partial unique index

Hoá đơn proration dùng chung `periodStart` với hoá đơn cuối kỳ, nên
`UNIQUE (subscription_id, period_start)` phải thu hẹp còn
`WHERE billing_reason = 'subscription_cycle'`.

`findPeriodInvoice` **bắt buộc** phải lọc theo `billing_reason`. Không lọc, nó trả về hoá đơn
proration như "draft của kỳ này", `ensureDraftInvoice` báo `isCreated: false`, và **billing run âm
thầm ngừng draft** — không có gì throw.

Enum chỉ hai member. `subscription_create` là khái niệm của advance billing (hệ này không xuất gì
lúc tạo) và `manual` không có producer; cột là `text` nên thêm member sau là sửa một dòng.

## Hệ quả

- Backfill `billed_through = deleted_at` là **điều kiện sống còn**: rating không còn lọc
  `deleted_at`, nên một row đã soft-delete mà cửa sổ còn mở sẽ bị bill trọn kỳ, mãi mãi.
- `invoiced_through` không backfill. Các lát lịch sử vừa được mở ra **sẽ** được bill vào kỳ tới —
  đó là bug tính thiếu đang được sửa.
- Void một hoá đơn proration phải mở lại `invoiced_through`, nếu không là mất vĩnh viễn khoản đó.
- Hoá đơn proration vào dunning như mọi hoá đơn OPEN. Đó là khoản phải thu thật.

## Giới hạn đã biết

- **`none` trên item metered âm thầm bỏ usage** khi item thay thế trỏ **meter khác**. Cùng meter thì
  không mất gì, vì item mới có `billed_from = periodStart` nên đo trọn kỳ. Không thêm guard: `none`
  nghĩa là không cắt lát, mà một cửa sổ usage một phần chính là một lát.
- **Làm tròn `HALF_UP` từng dòng** nên tổng các lát không khớp tuyệt đối với một kỳ trọn, và với
  `always_invoice` phần dư còn chia qua hai hoá đơn. Không sửa bằng một dòng điều chỉnh.
- **`replaceSubscriptionItems` churn id item** kể cả khi chỉ đổi quantity. Có sẵn từ trước, cố ý để
  ngoài scope — thêm diffing giữ id sẽ làm ba nhánh behavior thành ba đường code khác hẳn nhau.
- **Draft mắc kẹt**: update sau khi kỳ đã roll nhưng trước khi finalize thì guard
  [invoice.service.ts:123](../../packages/core/src/services/invoice.service.ts) từ chối vĩnh viễn
  draft đó. Không làm tệ hơn, không sửa ở đây.
- **`finalizeInvoice` và `ensureDraftInvoice` dùng `clock.now()`**, nên subscription gắn test clock
  nhận `finalizedAt` / `dueAt` theo giờ thật. Đường proration thread `resolveNow` đúng, nên hai
  đường có thể lệch timestamp vì lý do không liên quan gì tới proration.
- **Ledger account provisioning thoát khỏi transaction** (`ensureAccount` gọi không executor, nuốt
  unique violation). Có sẵn, vô hại, nhưng nay xảy ra trên đường request update chứ không chỉ trong
  worker.

## Đọc tiếp

- [technique 06 — Proration](../technique/06-proration.md) — cơ chế: cửa sổ tính tiền, ba behavior, ví dụ có số
- [technique 05 — Product và price](../technique/05-product-and-price.md) — vì sao subscription trỏ price
- [flow 05 — Metering và rating](../flows/05-metering-and-rating.md) — cửa sổ tính tiền và loại dòng
- [ADR 0008](./0008-phase-5-rating.md) — engine rating gốc, nơi `isCredit` ra đời
