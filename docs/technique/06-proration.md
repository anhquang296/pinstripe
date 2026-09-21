# Proration — cắt lát một kỳ khi hợp đồng đổi giữa chừng

Một subscription mô tả "500.000 đồng một tháng". Câu đó chỉ đúng khi cả tháng khách dùng đúng một
thứ. Ngày 10 của kỳ khách nâng lên gói 1.000.000, và bây giờ kỳ đó không còn một giá nào mô tả được
nó: mười ngày đầu đáng giá gói cũ, hai mươi ngày sau đáng giá gói mới. Proration là cách hệ thống
trả lời câu "kỳ này thu bao nhiêu" khi kỳ ấy chứa nhiều hơn một hợp đồng.

Code: [`rating.ts`](../../packages/modules/billing/src/utils/rating.ts),
[`rating.service.ts`](../../packages/modules/billing/src/services/rating.service.ts),
[`subscription.service.ts`](../../packages/modules/billing/src/services/subscription.service.ts),
[`invoice.service.ts`](../../packages/modules/billing/src/services/invoice.service.ts),
migration [`0000_baseline.sql`](../../packages/modules/billing/migrations/0000_baseline.sql).
Quyết định và các phương án bị loại nằm ở [ADR 0013](../adr/0013-arrears-proration.md); tài liệu này
nói **cơ chế**: một lát tiền được tính ra như thế nào, ba `prorationBehavior` khác nhau ở đúng chỗ
nào, và một lần đổi gói để lại dấu vết gì trong database.

## Vấn đề

Hệ này bill **in arrears** — hoá đơn phát hành ở cuối kỳ, phủ kỳ vừa kết thúc. Kết hợp với cách
`updateSubscription` thay item (mint id mới, soft-delete cả bộ cũ), bốn việc bình thường đều hỏng
nếu không có gì cắt lát:

| Việc                               | Hỏng ở đâu nếu không có proration                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Khách nâng gói ngày 10             | item cũ bị soft-delete, rating lọc `deleted_at is null` → **mười ngày đó không ai thu** |
| Khách hạ gói ngày 25               | ngược lại: nếu tính giá mới trọn kỳ thì hai mươi lăm ngày gói đắt bị tính giá gói rẻ    |
| Tăng giá đồng loạt cho toàn bộ tệp | cắt lát là sai — ý định là "từ kỳ này áp giá mới", không phải "chia đôi kỳ"             |
| Thu tiền ngay khi khách nâng gói   | không có đường nào xuất hoá đơn giữa kỳ                                                 |

Ba dòng đầu là chuyện **tính đúng**. Dòng thứ tư là chuyện **thu khi nào**. `prorationBehavior` trả
lời cả hai bằng một tham số duy nhất trên `POST /v1/subscriptions/:id`.

## Hai mode, một engine

Từ phase 17 một subscription mang `billingMode`, mặc định `advance`. Cơ chế dưới đây — ba cột cửa sổ,
ba `prorationBehavior`, `resolveBillingWindow` — là của **cả hai** mode; thứ khác nhau là mốc phát hoá
đơn, và vì thế là dấu của dòng proration. Phần dưới mô tả `arrears`; chỗ `advance` lệch đi nằm ở
[ADR 0018](../adr/0018-bill-in-advance.md).

|                  | `advance` (mặc định)                           | `arrears`                |
| ---------------- | ---------------------------------------------- | ------------------------ |
| hoá đơn phát lúc | đầu kỳ, phủ kỳ sắp chạy                        | cuối kỳ, phủ kỳ vừa đóng |
| kỳ đầu           | một hoá đơn `subscription_create` ngay lúc tạo | không xuất gì lúc tạo    |
| đổi giữa kỳ      | một dòng credit âm + một dòng charge dương     | hai dòng dương           |
| item metered     | vẫn bill sau kỳ, trên cùng hoá đơn             | bill sau kỳ              |

## Điều quan trọng nhất: ở arrears, proration không đảo dấu

Ở `advance` — như Stripe, và như mặc định của hệ này — khách đã trả trọn kỳ ngay đầu kỳ, nên đổi giữa
kỳ phải **hoàn lại** phần chưa dùng của gói cũ rồi **thu thêm** phần còn lại của gói mới. Hai dòng,
một âm một dương, net lại thành chênh lệch.

Ở arrears, tại thời điểm swap **chưa ai trả đồng nào**. Không có gì để hoàn. Đúng nghiệp vụ là thu
**cả hai lát**, và cả hai đều dương.

|                          | Stripe (advance)                  | VXR ERP (arrears)                 |
| ------------------------ | --------------------------------- | --------------------------------- |
| Lúc swap khách đã trả gì | trọn kỳ theo giá cũ               | chưa gì cả                        |
| Lát gói cũ               | dòng **âm** — hoàn phần chưa dùng | dòng **dương** — thu phần đã dùng |
| Lát gói mới              | dòng dương — phần còn lại         | dòng dương — phần còn lại         |
| Tổng một kỳ              | chênh lệch                        | tổng hai lát                      |

`RatingLine.isCredit` ([rating.ts:44](../../packages/modules/billing/src/utils/rating.ts)) vẫn còn trong engine
và vẫn có unit test cho nhánh âm, nhưng **không producer nào trong code sản phẩm set nó**. Nó là chỗ
cắm sẵn cho chế độ advance sau này, không phải code chết — và cũng có nghĩa là hôm nay
`rateLines` không bao giờ trả về số âm.

## Mô hình: vòng đời của một item ≠ cửa sổ tính tiền của nó

Đây là ý tưởng trung tâm của cả thiết kế. Một `subscription_item` có **hai** khoảng thời gian khác
nhau, và trước migration 0015 chúng bị gộp làm một:

| Cột                | Trả lời câu                                 | Ai đọc                       |
| ------------------ | ------------------------------------------- | ---------------------------- |
| `created_at`       | row này ra đời lúc nào                      | audit, sắp xếp               |
| `deleted_at`       | row này còn sống không                      | API đọc subscription         |
| `billed_from`      | item bắt đầu **phát sinh tiền** từ lúc nào  | rating                       |
| `billed_through`   | ngừng phát sinh tiền lúc nào; `NULL` = chưa | rating                       |
| `invoiced_through` | phần cửa sổ **đã xuất hoá đơn** tới đâu     | rating, để không thu hai lần |

([subscriptions.schema.ts](../../packages/modules/billing/src/database/schemas/subscriptions.schema.ts))

> **Đã đổi ở phase 16.** Ba cột cửa sổ (`billed_from` / `billed_through` / `invoiced_through`) không
> còn nằm trên `subscription_items` mà ở bảng riêng `subscription_item_changes`, mỗi hàng một cửa sổ
> mang `price_id` và `quantity` của chính nó — nên đổi quantity giữ nguyên id item. Cách tính cửa sổ
> mô tả bên dưới giữ nguyên, chỉ đổi chỗ đọc. Xem [ADR 0017](../adr/0017-subscription-lifecycle.md).

Tách ra là vì `prorationBehavior` là tham số của **lần thay đổi**, không phải thuộc tính của product,
price hay subscription — nhưng rating chạy **trễ**, ở lúc finalize hoá đơn, có khi nhiều tuần sau. Ý
định lúc bấm nút phải được vật chất hoá xuống row, nếu không đến lúc tính tiền không ai còn biết lần
swap ấy muốn gì.

Cách vật chất hoá là một **mệnh đề về mốc thời gian**, không phải một cờ. Một lần gỡ với
`none` ghi `billed_through = currentPeriodStart`: một mốc thật, tự nó loại item khỏi kỳ này mà không
nói dối về các kỳ trước. Vì sao không dùng một cột enum — xem
[ADR 0013 §2](../adr/0013-arrears-proration.md).

Hai bất biến được ép ở tầng DB, không phải ở tầng service
([migration 0015](../../packages/modules/billing/migrations/0000_baseline.sql)):

```sql
CHECK (("deleted_at" IS NULL) = ("billed_through" IS NULL))
CHECK ("invoiced_through" IS NULL OR "billed_through" IS NOT NULL)
```

Câu thứ nhất: item còn sống ⟺ cửa sổ còn mở. Câu thứ hai: chưa đóng cửa sổ thì không thể đã xuất hoá
đơn cho nó.

## Hàm quyết định tất cả: `resolveBillingWindow`

Mọi câu hỏi "item này đóng góp bao nhiêu vào kỳ này" đi qua đúng một hàm thuần
([rating.ts:71-92](../../packages/modules/billing/src/utils/rating.ts)):

```ts
const invoicedThroughMs = invoicedThrough ? invoicedThrough.getTime() : periodStart.getTime();
const billedThroughMs = billedThrough ? billedThrough.getTime() : periodEnd.getTime();
const startMs = Math.max(billedFrom.getTime(), periodStart.getTime(), invoicedThroughMs);
const endMs = Math.min(billedThroughMs, periodEnd.getTime());

if (endMs <= startMs) {
  return null;
}
```

Bốn mốc, hai phép cắt. Cửa sổ tính tiền là giao của ba khoảng: **item phát sinh tiền**, **kỳ đang
tính**, và **phần chưa xuất hoá đơn**. `null` nghĩa là item không đóng góp dòng nào.

| Tình huống                                          | Kết quả                                     |
| --------------------------------------------------- | ------------------------------------------- |
| item sống suốt kỳ                                   | cửa sổ trọn kỳ, `isPartial: false`          |
| item có từ kỳ trước                                 | start bị kẹp về `periodStart`               |
| item bị gỡ giữa kỳ                                  | end = `billed_through`, `isPartial: true`   |
| item vừa thêm vừa gỡ trong kỳ                       | cửa sổ nằm gọn trong kỳ, `isPartial: true`  |
| item gỡ với `none` (`billed_through = periodStart`) | `null` — không dòng nào                     |
| lát đã được hoá đơn proration thu                   | `null` — `invoiced_through` đẩy start = end |

`isPartial` là thứ quyết định hai việc ở tầng trên
([rating.service.ts:125-130](../../packages/modules/billing/src/services/rating.service.ts)):

- **loại dòng**: metered → `usage`; partial → `proration`; còn lại → `subscription`
- **có prorate không**: chỉ dòng partial **và không metered** mới mang `usageStart` / `usageEnd`

Dòng metered cố tình giữ `prorationFactor = 1`. Usage đã được đo đúng trong cửa sổ hẹp rồi
([`resolveUsage`](../../packages/modules/billing/src/services/rating.service.ts) truyền `window.start` /
`window.end` xuống meter); nhân thêm hệ số nữa là chia hai lần cùng một thứ.

Phép nhân cuối ([rating.ts:213-230](../../packages/modules/billing/src/utils/rating.ts)):

```
prorationFactor = clamp(usedMs / periodMs, 0, 1)
amount          = ratePrice(price, quantity) × prorationFactor   // HALF_UP
```

Tỷ lệ theo **millisecond**, không theo ngày. Một kỳ tháng 2 và một kỳ tháng 3 chia lát khác nhau, và
đó là đúng.

## Ba behavior là ba mốc `boundary`

Toàn bộ khác biệt giữa ba chế độ nằm gọn trong ba dòng của
[`updateSubscription`](../../packages/modules/billing/src/services/subscription.service.ts):

```ts
const prorationBehavior = payload.prorationBehavior ?? ProrationBehaviorEnum.CREATE_PRORATIONS;
const isProrated = prorationBehavior !== ProrationBehaviorEnum.NONE;
const boundary = isProrated ? now : subscription.currentPeriodStart;
```

`boundary` vừa là `billed_through` của bộ item cũ, vừa là `billed_from` của bộ item mới — một mốc
duy nhất, nên không có khe hở và không có chồng lấn.

| `prorationBehavior`            | `boundary`           | Item cũ                       | Item mới                    | Hoá đơn tức thì |
| ------------------------------ | -------------------- | ----------------------------- | --------------------------- | --------------- |
| `create_prorations` (mặc định) | `now`                | lát đã dùng, dồn về cuối kỳ   | lát còn lại                 | không           |
| `none`                         | `currentPeriodStart` | cửa sổ dài 0 → **không dòng** | **trọn kỳ**, factor 1       | không           |
| `always_invoice`               | `now`                | lát đã dùng, **thu ngay**     | lát còn lại, dồn về cuối kỳ | có              |

Hai ràng buộc ở cùng chỗ:

- `prorationBehavior` **không có `items` là 400**
  ([subscription.service.ts:174](../../packages/modules/billing/src/services/subscription.service.ts)):
  `prorationBehavior only applies when items change`. Không có lát nào để cắt khi không có gì đổi.
- `cancelSubscription` **không nhận** `prorationBehavior`. Huỷ giữa kỳ không sinh credit — xem
  [§ Giới hạn](#giới-hạn-phải-biết).

## Ví dụ: nâng 500.000 → 1.000.000 vào ngày 10 của kỳ 30 ngày

Cùng một hành động, ba behavior, ba kết quả khác nhau về tiền **và** về thời điểm thu.

### `create_prorations` — mặc định

```
kỳ  [────────── 30 ngày ──────────]
cũ  [── 10 ──]                        billed_from=day0   billed_through=day10
mới          [────── 20 ──────]       billed_from=day10  billed_through=NULL
```

Cuối kỳ, `rateUpcomingInvoice` lấy **cả hai** — nó lọc theo cửa sổ chứ không lọc `deleted_at`, nên
item đã soft-delete vẫn được tính:

| Dòng     | factor | Tính                | Thành tiền  |
| -------- | ------ | ------------------- | ----------- |
| gói cũ   | 10/30  | 500.000 × 0,3333…   | **166.667** |
| gói mới  | 20/30  | 1.000.000 × 0,6666… | **666.667** |
| **Tổng** |        |                     | **833.334** |

Nằm giữa 500.000 (trọn kỳ gói cũ) và 1.000.000 (trọn kỳ gói mới), đúng như trực giác. Cả hai dòng
mang `type = proration`.

### `none` — không cắt lát

```
kỳ  [────────── 30 ngày ──────────]
cũ  ×                                 billed_through = periodStart → cửa sổ rỗng
mới [──────── 30 ────────]            billed_from    = periodStart → trọn kỳ
```

| Dòng    | factor | Thành tiền    |
| ------- | ------ | ------------- |
| gói cũ  | —      | **không có**  |
| gói mới | 1      | **1.000.000** |

Một dòng `type = subscription`, không phải `proration`. **Đây là chỗ dễ hiểu nhầm nhất của cả tài
liệu**: `none` ở đây **không** cùng nghĩa với `none` của Stripe. Stripe `none` nghĩa là không sinh
dòng proration và giá mới áp từ kỳ sau; ở đây, vì bill in arrears và kỳ hiện tại chưa ai trả, `none`
nghĩa là **giá mới áp cho trọn kỳ hiện tại, kể cả phần đã trôi qua trước lúc đổi**.

Đó là hành vi đúng cho ca dùng nó sinh ra: một lần **tăng giá đồng loạt** hoặc đổi price version cho
cả tệp khách, nơi cắt lát là nhiễu chứ không phải chính xác. Đó là hành vi **sai** cho một cú hạ gói
ngày 25 — khách sẽ được tính giá rẻ cho cả hai mươi lăm ngày đã dùng gói đắt.

### `always_invoice` — thu ngay phần đã tiêu thụ

Tại mốc swap, trong **cùng transaction** với việc thay item
([subscription.service.ts:217](../../packages/modules/billing/src/services/subscription.service.ts)):

| Lúc           | Hoá đơn                      | `billing_reason`      | Dòng                  | Tổng        |
| ------------- | ---------------------------- | --------------------- | --------------------- | ----------- |
| ngay khi swap | `INV-…` **OPEN**, đã đánh số | `subscription_update` | gói cũ, factor 10/30  | **166.667** |
| cuối kỳ       | `INV-…` cycle                | `subscription_cycle`  | gói mới, factor 20/30 | **666.667** |

Tổng vẫn 833.334, chỉ khác ở chỗ nó về thành hai tờ và tờ đầu đòi tiền ngay. Hoá đơn tức thì đi qua
đúng đường của mọi hoá đơn khác: lấy số từ sequence, chuyển OPEN, **post receivable vào sổ cái**, và
vào dunning nếu quá hạn. Nó là khoản phải thu thật.

### Vì sao hoá đơn tức thì chỉ thu lát đã đóng

Câu hỏi tự nhiên: sao không thu luôn 666.667 của gói mới cho xong một tờ?

Vì tại mốc swap, thứ duy nhất đã thực sự được tiêu thụ là mười ngày vừa trôi qua. Thu trước hai mươi
ngày chưa dùng **chính là bill in advance**, và nó phá vỡ bất biến `[periodStart, periodEnd]` mà
`ensureDraftInvoice` và guard của `finalizeInvoice` đang dựa vào. Cho nên
[`rateProrationInvoice`](../../packages/modules/billing/src/services/rating.service.ts) lọc đúng một điều kiện:
`deletedAtIsNull: false` — chỉ những item đã đóng cửa sổ.

Và nó quét **mọi** cửa sổ đã đóng chưa xuất hoá đơn trong kỳ, không chỉ cửa sổ do lần gọi này đóng.
Một lần swap `create_prorations` hôm trước cũng để lại một lát đã tiêu thụ chưa ai thu; lần
`always_invoice` hôm nay dọn cả hai.

Sau khi ghi hoá đơn, `markSubscriptionItemsInvoiced` set `invoiced_through = billed_through`
([subscription.repository.ts:134-148](../../packages/modules/billing/src/repositories/subscription.repository.ts)).
Đến cuối kỳ, `resolveBillingWindow` của item đó cho `startMs = endMs` → `null` → không lặp lại. Đó là
toàn bộ cơ chế chống thu hai lần.

## Hai hoá đơn chung một kỳ: `billing_reason`

Hoá đơn proration mang đúng `periodStart` của kỳ hiện tại, nên nó **trùng kỳ** với hoá đơn cuối kỳ.
Unique index cũ phải thu hẹp lại
([invoices.schema.ts:62-64](../../packages/modules/billing/src/database/schemas/invoices.schema.ts)):

```sql
CREATE UNIQUE INDEX invoices_subscription_cycle_period_idx
  ON invoices (subscription_id, period_start)
  WHERE billing_reason = 'subscription_cycle';
```

Kéo theo một ràng buộc **bắt buộc** ở tầng service: `findPeriodInvoice` phải lọc
`billingReason: SUBSCRIPTION_CYCLE`
([invoice.service.ts:402-413](../../packages/modules/billing/src/services/invoice.service.ts)). Không lọc, nó
trả về hoá đơn proration như thể đó là draft của kỳ này, `ensureDraftInvoice` báo `isCreated: false`,
và **billing run âm thầm ngừng draft** — không có gì throw, không có gì trong log. Đây là chế độ hỏng
tệ nhất của cả tính năng, và nó được pin bằng một test riêng
(`still drafts the cycle invoice for the same period after a proration invoice was issued`).

## Void một hoá đơn proration phải mở lại cửa sổ

`invoiced_through` là lời khẳng định "đã thu rồi". Void hoá đơn làm lời đó sai, nên void phải rút nó
lại ([invoice.service.ts:339-341, 392-400](../../packages/modules/billing/src/services/invoice.service.ts)):

```ts
if (invoice.billingReason === BillingReasonEnum.SUBSCRIPTION_UPDATE) {
  await this.reopenInvoicedItems(invoice.id, tx);
}
```

`reopenSubscriptionItemInvoicing` set `invoiced_through = NULL`, và lát ấy quay lại hoá đơn cuối kỳ.
Thiếu bước này là mất vĩnh viễn khoản đó — không lỗi, không cảnh báo, chỉ là một dòng không bao giờ
xuất hiện nữa.

## Step by step — dựng một cú swap và xem từng lát

Cần môi trường dev đã `pnpm docker:up`, `pnpm db:migrate`, `pnpm dev`. Dùng test clock để không phải
chờ hết tháng thật.

```bash
set -a && . ./.env && set +a
API=http://localhost:3000
AUTH="Authorization: Bearer $SECRET_API_KEY"
JSON='content-type: application/json'
IDEM() { echo "Idempotency-Key: $(uuidgen)"; }
```

**Bước 1 — Test clock đứng ở đầu kỳ.**

```bash
CLOCK=$(curl -s -X POST $API/v1/test_helpers/test_clocks -H "$AUTH" -H "$JSON" -H "$(IDEM)" \
  -d '{"name":"proration demo","frozenTime":"2026-10-01T00:00:00.000Z"}' | jq -r '.id')
echo $CLOCK
```

**Bước 2 — Khách gắn clock, một product, hai price.**

```bash
CUST=$(curl -s -X POST $API/v1/customers -H "$AUTH" -H "$JSON" -H "$(IDEM)" \
  -d "{\"email\":\"proration@example.test\",\"currency\":\"vnd\",\"testClockId\":\"$CLOCK\"}" | jq -r '.id')

PROD=$(curl -s -X POST $API/v1/products -H "$AUTH" -H "$JSON" -H "$(IDEM)" \
  -d '{"name":"Demo plan"}' | jq -r '.id')

mkprice() {
  curl -s -X POST $API/v1/prices -H "$AUTH" -H "$JSON" -H "$(IDEM)" \
    -d "{\"productId\":\"$PROD\",\"currency\":\"vnd\",\"unitAmount\":$1,\"billingScheme\":\"per_unit\",
         \"recurring\":{\"interval\":\"month\",\"intervalCount\":1,\"usageType\":\"licensed\"}}" | jq -r '.id'
}
OLD=$(mkprice 500000)
NEW=$(mkprice 1000000)
```

**Bước 3 — Đăng ký gói cũ.**

```bash
SUB=$(curl -s -X POST $API/v1/subscriptions -H "$AUTH" -H "$JSON" -H "$(IDEM)" \
  -d "{\"customerId\":\"$CUST\",\"items\":[{\"priceId\":\"$OLD\"}]}" \
  | jq -r '.id')

curl -s "$API/v1/invoices/upcoming?subscriptionId=$SUB" -H "$AUTH" \
  | jq '{total, lineItems: [.lineItems[] | {type, prorationFactor, amount}]}'
```

Mong đợi: một dòng `subscription`, `prorationFactor: 1`, `amount: 500000`.

**Bước 4 — Đẩy clock tới ngày 10, rồi swap với mặc định.**

```bash
curl -s -X POST $API/v1/test_helpers/test_clocks/$CLOCK/advance -H "$AUTH" -H "$JSON" -H "$(IDEM)" \
  -d '{"frozenTime":"2026-10-11T00:00:00.000Z"}' | jq -c '{frozenTime, status}'

curl -s -X POST $API/v1/subscriptions/$SUB -H "$AUTH" -H "$JSON" -H "$(IDEM)" \
  -d "{\"items\":[{\"priceId\":\"$NEW\"}],\"prorationBehavior\":\"create_prorations\"}" \
  | jq -c '{id, status}'

curl -s "$API/v1/invoices/upcoming?subscriptionId=$SUB" -H "$AUTH" \
  | jq '{total, lineItems: [.lineItems[] | {priceId, type, prorationFactor, amount}]}'
```

Mong đợi: **hai** dòng `proration`, factor xấp xỉ `0.32` và `0.68`, tổng nằm giữa 500.000 và
1.000.000. Đây là bước đáng chạy nhất — dòng của price cũ xuất hiện dù item ấy đã bị soft-delete.

**Bước 5 — Thử behavior sai chỗ.**

```bash
curl -s -X POST $API/v1/subscriptions/$SUB -H "$AUTH" -H "$JSON" -H "$(IDEM)" \
  -d '{"prorationBehavior":"none","metadata":{"note":"chỉ đổi metadata"}}' | jq
```

Mong đợi: **400** `prorationBehavior only applies when items change`.

**Bước 6 — `always_invoice` trên một subscription khác.** Lặp bước 1–4 rồi thay behavior:

```bash
curl -s -X POST $API/v1/subscriptions/$SUB2 -H "$AUTH" -H "$JSON" -H "$(IDEM)" \
  -d "{\"items\":[{\"priceId\":\"$NEW\"}],\"prorationBehavior\":\"always_invoice\"}" > /dev/null

curl -s "$API/v1/invoices?subscriptionId=$SUB2" -H "$AUTH" \
  | jq '.data[] | {number, status, billingReason, total}'
```

Mong đợi: một hoá đơn `OPEN`, có số `INV-…`, `billingReason: "subscription_update"`, tổng đúng bằng
lát gói cũ. Rồi `GET /v1/invoices/upcoming` chỉ còn **một** dòng — của price mới.

### Mốc thời gian

| Sau bước | `subscription_items` có gì                     | Upcoming invoice     |
| -------- | ---------------------------------------------- | -------------------- |
| 3        | 1 row, cửa sổ mở, `billed_from = periodStart`  | 1 dòng, 500.000      |
| 4        | 2 row — cũ đóng tại ngày 10, mới mở từ ngày 10 | 2 dòng proration     |
| 6        | thêm `invoiced_through` trên row cũ            | 1 dòng — lát còn lại |

### Kiểm chứng bằng SQL

Vòng đời và cửa sổ cạnh nhau — cột trái nói row còn sống không, cột phải nói nó thu tiền quãng nào:

```bash
docker compose -f docker/compose.yml exec -T postgres psql -U vxrerp -d vxrerp -c \
"select i.id, p.unit_amount, i.created_at, i.deleted_at, i.billed_from, i.billed_through, i.invoiced_through
 from billing.subscription_items i join billing.prices p on p.id = i.price_id
 where i.subscription_id = 'sub_...'
 order by i.created_at"
```

Các lát đã thành dòng hoá đơn, kèm hệ số:

```bash
docker compose -f docker/compose.yml exec -T postgres psql -U vxrerp -d vxrerp -c \
"select v.number, v.billing_reason, l.type, l.proration_factor, l.amount
 from billing.invoice_line_items l join billing.invoices v on v.id = l.invoice_id
 where v.subscription_id = 'sub_...'
 order by v.created_at, l.created_at"
```

## Giới hạn phải biết

- **`none` hồi tố cả kỳ hiện tại.** Không phải bug, nhưng khác Stripe và khác trực giác — xem lại
  [ví dụ `none`](#none--không-cắt-lát). Đừng dùng cho hạ gói.
- **Huỷ giữa kỳ không sinh credit.** `cancelSubscription` không có `prorationBehavior` và không nhận
  khái niệm proration; huỷ ngay chỉ set `endedAt`. Ở arrears điều này nhất quán — khách bị thu phần
  đã dùng ở kỳ cuối — nhưng đừng trông đợi một dòng hoàn tiền.
- **`none` trên item metered âm thầm bỏ usage** khi item thay thế trỏ **meter khác**. Cùng meter thì
  không mất gì vì item mới đo trọn kỳ. Không có guard: `none` nghĩa là không cắt lát, mà một cửa sổ
  usage một phần chính là một lát.
- **Làm tròn `HALF_UP` từng dòng.** Tổng các lát không khớp tuyệt đối với một kỳ trọn (833.334 chứ
  không phải 833.333), và với `always_invoice` phần dư còn chia qua hai hoá đơn. Không có dòng điều
  chỉnh nào bù lại.
- **`replaceSubscriptionItems` churn id item** kể cả khi chỉ đổi `quantity` — mọi item bị soft-delete
  và mint lại. Nên một lần "thêm một add-on" cũng re-anchor `billed_from` của các item không liên
  quan về `boundary`, biến chúng thành dòng partial. Có sẵn từ trước, cố ý để ngoài scope.
- **Draft mắc kẹt.** Update sau khi kỳ đã roll nhưng trước khi finalize thì guard
  [invoice.service.ts:126](../../packages/modules/billing/src/services/invoice.service.ts) từ chối draft đó vĩnh
  viễn.
- **`finalizeInvoice` dùng `clock.now()` thật**, còn đường proration thread `resolveNow(testClockId)`
  đúng. Subscription gắn test clock vì thế nhận `finalizedAt` / `dueAt` lệch — lý do không liên quan
  gì tới proration.

Danh sách đầy đủ kèm lý do chấp nhận: [ADR 0013 §Giới hạn](../adr/0013-arrears-proration.md).

## Điều kiện phải giữ

- **Mọi truy vấn item cho mục đích tính tiền lọc theo cửa sổ, không theo `deleted_at`.** Item đã
  soft-delete vẫn nợ tiền của lát nó đã chạy.
- **`billed_through` của bộ cũ và `billed_from` của bộ mới luôn là cùng một `boundary`.** Hai giá trị
  khác nhau tạo ra khe hở không ai thu, hoặc chồng lấn thu hai lần.
- **`findPeriodInvoice` luôn lọc `billing_reason = subscription_cycle`.** Bỏ bộ lọc là làm billing
  run ngừng draft trong im lặng.
- **Void hoá đơn `subscription_update` luôn set lại `invoiced_through = NULL`.**
- **Dòng metered không bao giờ nhân `prorationFactor`.** Cửa sổ đã hẹp rồi.
- **Backfill `billed_through = deleted_at` là điều kiện sống còn của migration 0015.** Rating không
  còn lọc `deleted_at`, nên một row đã xoá mềm mà cửa sổ còn mở sẽ bị bill trọn kỳ, mãi mãi.
- **Tiền luôn là số nguyên đơn vị nhỏ nhất**, hệ số là `double` và chỉ sống trong lúc tính —
  [utils/money.ts](../../packages/modules/billing/src/utils/money.ts).

## Đọc tiếp

- [ADR 0013 — Proration theo arrears](../adr/0013-arrears-proration.md) — vì sao chọn ba cột cửa sổ, và bốn phương án bị loại
- [flow 05 — Metering và rating](../flows/05-metering-and-rating.md) — engine rating, loại dòng, cách usage được đo
- [flow 06 — Invoicing](../flows/06-invoicing.md) — vòng đời draft → open → paid, nơi hoá đơn proration nhập làn
- [flow 08 — Billing run](../flows/08-billing-run.md) — `ensureDraftInvoice` và chỗ `billing_reason` quyết định
- [technique 05 — Product và price](./05-product-and-price.md) — vì sao subscription trỏ vào một price bất biến
- [technique 03 — Test clock](./03-test-clock.md) — cách đẩy thời gian để thấy một lát hình thành
- [UC-11 — Mô phỏng một chu kỳ](../usecases/11-simulate-a-billing-cycle.md) — kịch bản đầy đủ từ đăng ký tới thu tiền
