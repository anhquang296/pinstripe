# Roadmap V2 — Phase 10 → 24

[`ROADMAP.md`](ROADMAP.md) ghi phase 0–9 và dừng lại ở câu "roadmap đã hết". File này là chặng tiếp
theo: đưa pinstripe từ **một lõi billing đúng đắn trong lớp vỏ ngây thơ** thành một bản clone Stripe
đủ để đọc mà hiểu Stripe vận hành thế nào, và đủ chắc để chạy cho ứng dụng nội bộ.

Phase 0–9 dựng xong sổ kép, outbox, idempotency, rating, proration, metering, invoicing, payment giả
lập, dunning, webhook, portal và reporting. Thứ còn thiếu không phải chiều sâu mà là **bề mặt**: không
coupon, không thuế, không `InvoiceItem`, `PaymentMethod` mới chỉ là một chuỗi string, chưa có object
`Event`, chưa có Checkout, và bốn API key phẳng là toàn bộ lớp cô lập. So sánh đầy đủ nằm rải trong
từng phase dưới đây.

Nền tảng chung vẫn là [`RESEARCH.md`](RESEARCH.md). Những chỗ code chạy đúng mà tiền ra sai nằm ở
[`PITFALLS.md`](PITFALLS.md) — file đó là đầu vào trực tiếp của phase 10.

## Quyết định khung cho V2 (đã chốt)

| Vấn đề         | Chốt                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| Tenancy        | **Single-tenant.** Không có `accountId` ở bất kỳ bảng nào. Vẫn làm test/live mode.            |
| Thu tiền thật  | **Chưa.** Giữ mock PSP; vẫn dựng đủ PaymentMethod / SetupIntent / 3DS / callback bất đồng bộ. |
| Trục ưu tiên   | **Sửa nền trước**, rồi mới mở bề mặt. Lỗi đã biết không được mang theo sang tính năng mới.    |
| Bề mặt so sánh | Stripe Billing + Payments. Connect, Issuing, Terminal, Treasury, Radar, Identity nằm ngoài.   |

Hai quyết định của V1 giữ nguyên: wire dùng **camelCase** (lệch Stripe có chủ ý), và stack Fastify +
PostgreSQL + BullMQ + Drizzle.

## Tiến độ

| Phase | Nội dung                                                                      | Công sức | Nhóm             |
| ----- | ----------------------------------------------------------------------------- | -------- | ---------------- |
| 10    | Lưới test + sửa lỗi mất tiền / trùng tiền                                     | L        | Nền              |
| 11    | API key trong DB + scopes + `livemode`                                        | M        | Nền — bẫy #4     |
| 12    | Vỏ platform: `events`, `expand[]`, versioning, rate limit, webhook DLQ        | L        | Nền              |
| 13    | Mô hình tổng hoá đơn + `InvoiceItem` + hoá đơn rời + tách bút toán            | XL       | Nền — bẫy #1     |
| 14    | Giảm giá: Coupon, PromotionCode, Discount                                     | M        | Bề mặt           |
| 15    | Thuế: TaxRate, dòng thuế, TaxId, khớp nối hoá đơn điện tử                     | L        | Bề mặt (pháp lý) |
| 16    | Hoàn thiện vòng đời subscription                                              | XL       | Nền — bẫy #2     |
| 17    | Chuyển sang bill **in advance**                                               | XL       | Trung thành      |
| 18    | Mô hình payment: PaymentMethod, SetupIntent, Charge, 3DS, callback            | XL       | Nền — bẫy #3     |
| 19    | Dòng tiền: BalanceTransaction, Balance, Payout, Dispute, refund/CN v2         | L        | Bề mặt           |
| 20    | Bề mặt khách: portal auth, billing portal, Checkout, Payment Link, PDF, email | XL       | Bề mặt           |
| 21    | SubscriptionSchedule + billing thresholds                                     | L        | Bề mặt           |
| 22    | Catalog fidelity: `currencyOptions`, Feature/ProductFeature, `aggregateUsage` | M        | Bề mặt           |
| 23    | Search API, OpenAPI, observability, load test                                 | M        | Vận hành         |
| 24    | PSP thật + nhà cung cấp hoá đơn điện tử                                       | L        | Hoãn có chủ ý    |

Ba phase XL là 13, 16, 18 — cộng thêm 17 và 20. Mọi thứ còn lại là phụ thuộc của chúng.

## Đường ngắn nhất, nếu một ngày phải chạy thật

Không phải lúc nào cũng có đủ thời gian cho cả 15 phase. Thứ tự tối thiểu để một đồng tiền thật đi qua
hệ này mà không sai sổ:

> **10 → 11 → 13 → 15 → 16 → 18 → 19 (chỉ phần reconciliation) → 20 (chỉ phần portal auth)**

Hoãn được: `expand`/versioning của 12 (giữ lại rate limit và webhook DLQ), toàn bộ 14, 17, 21, 22, 23.
Không hoãn được cái nào trong danh sách trên: 13 vì sổ cái không restate được, 15 vì là nghĩa vụ pháp
lý, 16 vì hôm nay subscription không tự roll kỳ, 18 vì không lưu được thẻ thì không thu tự động được.

---

## Phase 10 — Lưới test + lỗi tiền

**Mục tiêu.** Mua một lưới an toàn trước khi bất cứ thứ gì có cấu trúc dịch chuyển, và đóng những lỗi
đang làm mất hoặc nhân đôi tiền ngay hôm nay.

**Vì sao ở đây.** Mọi phase bên dưới đều viết lại đường đi của tiền, trong khi `apps/api` và
`apps/worker` hiện **không có một test nào**, và integration test chạy thẳng vào database dev không
truncate ([PITFALLS §10](PITFALLS.md#10-lưu-ý-khi-test)). Làm phase 11 (thêm cột vào mọi bảng) hay
phase 13 (viết lại tổng hoá đơn) mà không có lưới là refactor trong bóng tối. Phase này mở đường cho
tất cả những phase còn lại và tự nó đã là điều kiện để thu tiền thật.

**Deliverables.**

- Hạ tầng test: testcontainers, hoặc một database `pinstripe_test` riêng với truncate giữa các file;
  bước migrate trong `globalSetup`; đưa `.integration.test.ts` vào task `test` của turbo với
  `cache: false`. Redis dùng index khác cho test.
- Suite `fastify.inject()` cho ~40 route: bốn auth hook, hình dạng lỗi, nhánh replay của idempotency
  đi qua HTTP, các biên của cursor pagination.
- Unit test cho logic thuần đã được điểm danh: `assertTransition`, `assertPricesUsable`,
  `resolveInterval`, `resolveTrialEnd`, `assertPriceShape`, `resolveReplay`, `cursor.ts`.
- Factory dùng chung (`makeOpenInvoice`, customer + test clock, subscription) — hiện đang chép ba lần.
- `resolveNow(entity)` thành helper dùng chung. Hôm nay chỉ `SubscriptionService` biết test clock, nên
  mọi tính năng theo thời gian dựng sau sẽ thừa hưởng một cái đồng hồ chạy trong test mà không chạy
  thật, hoặc ngược lại.
- Từng lỗi dưới đây đi kèm test chứng minh:
  - `payInvoice` thêm `SELECT … FOR UPDATE` trên dòng invoice trong transaction, tính `amountPaid` từ
    dòng đã khoá. Hiện là read-modify-write, hai lần trả một phần đồng thời làm mất một lần.
  - Dunning hết charge trùng: dùng lại payment intent đang mở của invoice thay vì mint intent mới mỗi
    lần thử, hoặc suy idempotency key của PSP từ `(invoiceId, attemptCount)`. Bọc vòng lặp từng
    invoice trong try/catch.
  - Reaper cho trạng thái kẹt: outbox `publishing` hết hạn lease và `failed` requeue, `test_clocks`
    kẹt `advancing`, `webhook_deliveries` quá số lần thử.
  - Idempotency: gọi `deleteExpiredRequests` (hiện không có caller), thu hồi `in_progress` theo
    `lockedAt`, thôi cache response 4xx.
  - `isWebhookSignatureValid` thêm cửa sổ dung sai thời gian — điều kiện bắt buộc trước route callback
    của phase 18.
  - Unique index `(endpointId, eventId)` trên `webhook_deliveries`, để retry của domain-event không
    nhân đôi webhook gửi cho khách.
  - Entitlement bị thu hồi khi product bị gỡ khỏi subscription. Hiện `handleSubscriptionChanged`
    upsert theo price hiện tại và không đụng tới entitlement mồ côi.
  - `MockPspClient` chuyển state từ in-memory sang Postgres hoặc Redis, để charge do worker tạo ra
    refund được từ API; lỗi của nó kế thừa `AppError`.

**Quyết định bị ép phải chốt.** Cô lập database test bằng container hay bằng truncate. Và `resolveNow`
nhận entity nào làm nguồn thời gian khi một request chạm nhiều entity gắn test clock khác nhau.

**Xong khi.** `pnpm test` chạy unit + route + integration trên một database dùng xong bỏ, không bị
cache lỗi thời, và hai lần trả một phần đồng thời với số tiền khác nhau trên cùng một hoá đơn cộng
lại đúng.

**Công sức: L.**

---

## Phase 11 — Key model + `livemode`

**Mục tiêu.** Biến "dữ liệu này ở chế độ nào, ai được đọc" thành cột và bản ghi, thay vì bốn biến môi
trường và lòng tin.

**Vì sao ở đây.** `livemode` có đúng hình dạng của một cột tenant: nó chạm mọi bảng, mọi unique index,
và dòng đơn `number_sequences`. Hôm nay có ~20 bảng; sau phase 22 sẽ có ~40. Đây là thời điểm rẻ duy
nhất. Trường `scope` của idempotency đang hardcode `'default'` chính là chỗ đợi sẵn cho phase này.

**Deliverables.**

- Bảng `api_keys`: `type` (`secret | restricted | publishable`), hash của key, `scopes`, `livemode`.
  Thay bốn biến `SECRET_API_KEY` / `ADMIN_API_KEY` / `SYSTEM_API_KEY` / `MANAGEMENT_API_KEY`; ba
  nhóm admin / system / management trở thành role trên cùng bảng đó. Bốn hook trong
  `apps/api/src/hooks/` chuyển từ so sánh hằng số sang tra key và kiểm scope.
- Cột `livemode` trên mọi bảng domain. Mọi unique index thành `(livemode, …)` — gồm
  `invoices_number_idx`, `customers_email_idx`, `prices_lookup_key_version_idx`, cặp
  `code/currency/customerId` của ledger account, và `ledgerTransactions.externalId`.
- `number_sequences` khoá lại theo `(livemode, name)`. Hôm nay là một dòng toàn cục; dãy số
  `INV-000001` liên tục cho mỗi chế độ là yêu cầu kế toán, và dòng này vốn đã là điểm serialize.
- Test clock chỉ gắn được vào `livemode = false`. Đây là lý do chính để làm test/live mode ở một hệ
  single-tenant: hiện không có gì ngăn một test clock chạm vào dữ liệu thật.
- `request.auth = { livemode, scopes }`; một guard ở tầng repository (ESLint rule hoặc helper) để một
  query thiếu `livemode` không lint sạch. Idempotency `scope` = `livemode`.
- Migration backfill: toàn bộ dữ liệu hiện có về `livemode = true`.

**Quyết định bị ép phải chốt.** `livemode` là một cột trên bảng chung, hay hai database. Chọn cột:
view số dư của ledger, billing run chia shard và cursor pagination đều giả định một bảng vật lý. Và
restricted key kiểm scope theo route hay theo resource — chọn theo route, khai ngay trong route schema.

**Xong khi.** Một key `livemode = false` không nhìn thấy một object thật nào ở mọi route list/get, có
route test chứng minh; và hai chế độ cùng giữ được `INV-000001`.

**Công sức: M.**

---

## Phase 12 — Vỏ platform

**Mục tiêu.** Chốt hợp đồng response và serialization **trước khi** số lượng resource tăng gấp đôi.

**Vì sao ở đây.** `expand[]` và versioning là chuyện của tầng serializer: sửa xuyên ~40 route thì phiền,
xuyên ~100 route sau phase 22 thì là một tháng. Quan trọng hơn: **hệ này chưa có bảng `events`**.
`outbox_events` là hàng đợi relay nội bộ, payload là shape nội bộ không có `apiVersion`, và
`webhookDeliveries.eventId` trỏ vào nó mà không có khoá ngoại. `GET /v1/events`, replay webhook, và
callback của Checkout lẫn PSP đều cần một object `Event` công khai và bền. Dựng bây giờ thì phase 13
trở đi phát Event thật ngay từ đầu, thay vì phải migrate lại.

**Deliverables.**

- Bảng `events`: `id`, `livemode`, `type`, `apiVersion`, `data.object` là **snapshot tại thời điểm
  phát**, `requestId`, `idempotencyKey`, `createdAt`. Outbox giữ nguyên vai trò relay giao dịch;
  việc của relay giờ là materialize Event rồi fan-out tới endpoint. Route `GET /v1/events` và
  `GET /v1/events/:eventId`, kèm cửa sổ lưu trữ.
- `expand[]`: một bản đồ expansion khai báo theo resource (`invoice.customer`, `invoice.subscription`,
  `subscription.defaultPaymentMethod`, …) giải ở một tầng serializer duy nhất, giới hạn độ sâu 4, có
  loader gom truy vấn để không N+1.
- Header `Pinstripe-Version` + transformer response theo version, version được pin vào key lúc tạo.
  Kể cả khi chỉ có một version, thứ cần giao là **cái mối nối**.
- Rate limit: token bucket theo key cho chiều vào; giới hạn **theo từng endpoint** cho webhook đi ra —
  [`ROADMAP.md`](ROADMAP.md) gọi đây là thứ phải có trước production.
- Bảng dead-letter + route replay một delivery. Helper verify chữ ký có tolerance (từ phase 10) xuất ra
  SDK.
- Taxonomy lỗi kiểu Stripe: `type` / `code` / `declineCode` / `param`, khai một chỗ, áp bởi error handler.
- `WEBHOOK_SIGNING_SECRET` — hiện khai bắt buộc trong env mà không code nào đọc — hoặc trở thành khoá
  ký cấp platform cho relay Event, hoặc bị xoá khỏi env schema. Không để nguyên.
- SDK: resource `events`, tham số `expand` luồn qua, `webhooks.constructEvent`.

**Quyết định bị ép phải chốt.** Payload của Event là **snapshot lúc phát**, không phải đọc lại lúc
giao. Đọc lại thì một webhook replay sẽ hiện trạng thái hiện tại — sai một cách rất khó thấy.

**Xong khi.** `GET /v1/invoices/:id?expand[]=customer&expand[]=subscription` trả về object lồng nhau,
cùng một event id lấy lại được từ `/v1/events`, và một delivery replay giống hệt bản gốc từng byte.

**Công sức: L.**

---

## Phase 13 — Mô hình tổng hoá đơn

**Mục tiêu.** Biến hoá đơn từ "một con số" thành tài liệu mà giảm giá, thuế, số dư khách và trả từng
phần đều ghi vào — một lần, đúng chỗ.

**Vì sao ở đây.** Đây là cái bẫy viết lại đắt nhất. Hôm nay `subtotal = total = rated.total`,
`invoiceLineItems.priceId` là `NOT NULL` và không có `description` hay `unitAmount`, và `postReceivable`
ghi đúng một cặp AR ↔ revenue. Sổ cái bị trigger chặn UPDATE/DELETE, nên một khi đã ghi revenue gộp cả
thuế và bỏ qua giảm giá thì **không restate được** — chỉ đảo từng bút toán một. Coupon (14), thuế (15),
số dư khách, và credit note có dòng (19) đều phụ thuộc vào hình dạng này. Làm trước tất cả những thứ
đó, và trước khi hệ chạm tiền thật.

**Deliverables.**

- `invoices` thêm: `subtotalExcludingTax`, `totalDiscountAmount`, `totalTaxAmount`, `amountDue`,
  `amountRemaining`, `startingBalance`, `endingBalance`, `autoAdvance`, `collectionMethod`,
  `daysUntilDue`, `attempted`. `billingReason` mở đủ bộ: thêm `subscription_create`,
  `subscription_threshold`, `manual`, `upcoming`.
- `invoice_line_items`: `priceId` thành nullable; thêm `description`, `unitAmount`, `invoiceItemId`,
  `discountAmounts`, `taxAmounts`, `amountExcludingTax`, `discountable`. `LineItemType` thêm
  `invoiceitem`, `discount`, `tax`.
- Bảng `invoice_items` (đúng `InvoiceItem` của Stripe): dòng chờ, gắn vào hoá đơn kế tiếp của khách
  hoặc vào một hoá đơn chỉ định. CRUD `/v1/invoiceitems`.
- **Hoá đơn rời**: bỏ ràng buộc bắt buộc `subscriptionId` trong `finalizeInvoice`; tách rating thành
  ba bước — gom dòng (rating subscription ∪ invoice item chờ ∪ dòng ad-hoc) → ráp tổng → ghi. Guard so
  khớp kỳ chỉ còn áp cho hoá đơn của subscription.
- `autoAdvance` có hiệu lực: một worker đẩy `draft → open` sau độ trễ finalize; `collectionMethod`
  bắt đầu được đọc — `send_invoice` thì không tự thu và đặt `dueAt` theo `daysUntilDue`,
  `charge_automatically` thì đẩy sang hàng đợi thu tiền. Hôm nay cột này nằm trên subscription và
  **không ai đọc**.
- **Tách bút toán**: `postReceivable` tách thành AR ↔ (revenue, `tax_payable`, `customer_credit_balance`).
  Dùng `money.allocate(weights)` để chia giảm giá và thuế xuống từng dòng, phần dư đẩy vào
  `rounding_difference`. Mở rộng hợp đồng `externalId` **có chủ ý** và sửa `reconciliation.service.ts`
  trong cùng commit — hôm nay không có test nào giữ hợp đồng đó, nên viết test ấy ở đây.
- Số dư khách bắt đầu được ghi thật: `customers.balance` + bút toán `customer_credit_balance` + bảng
  `customer_balance_transactions` + route. Hôm nay cột `balance` chưa có một chỗ nào ghi.
- Đổi `paymentIntents.invoiceId` và `refunds.invoiceId` thành **nullable ngay tại đây**, và thêm bảng
  `invoice_payments` (invoice ↔ payment intent ↔ số tiền), dù phải tới phase 18 mới có PaymentIntent
  độc lập. Đằng nào cũng đang viết lại `payInvoice`; làm hai lần mới là lãng phí.

**Quyết định bị ép phải chốt.** `total` đã gồm thuế hay chưa (`taxBehavior: inclusive` / `exclusive`) —
chốt bây giờ, vì nó đổi mọi con số phía sau. Số dư khách áp vào hoá đơn là một dòng hay một trường cấp
hoá đơn (Stripe chọn cấp hoá đơn: `startingBalance`). Và chính sách chia phần dư khi phân bổ.

**Xong khi.** Một hoá đơn hai dòng, có một khoản giảm giá cố định, một thuế suất và một phần số dư
khách được áp, cân đến từng đồng; bút toán của nó cân; reconciliation khớp nó — và tất cả diễn ra
**không cần một subscription nào tồn tại**.

**Công sức: XL.**

---

## Phase 14 — Giảm giá

**Mục tiêu.** Trừ đi một con số mà mô hình hoá đơn đã biết cách chứa.

**Vì sao ở đây.** Thuần cộng thêm, **với điều kiện** phase 13 đã xong. Làm trước 13 thì vẫn phải viết
lại tổng hoá đơn, chỉ khác là viết lại với một cái lỗ hình coupon trong đó.

**Deliverables.** `coupons` (`percentOff` | `amountOff`, `duration` once/repeating/forever,
`durationInMonths`, `maxRedemptions`, `redeemBy`, `appliesTo.products`, currency);
`promotion_codes` (code, active, `maxRedemptions`, `expiresAt`, ràng buộc gồm `firstTimeTransaction`
và `minimumAmount`); `discounts` ở các mức customer / subscription / subscription item / invoice /
invoice item. Bộ đếm redemption an toàn race bằng `UPDATE … RETURNING`. Một bước áp giảm giá nằm giữa
rating và ráp tổng, ghi `discountAmounts` xuống từng dòng. Event `customer.discount.created/updated/deleted`.
Route + SDK + form trong admin-ui.

**Quyết định bị ép phải chốt.** Thứ tự chồng giảm giá — Stripe áp giảm giá **trước** thuế và áp nhiều
giảm giá tuần tự lên số dư đang chạy; chọn một cách và ghi lại. `durationInMonths` đếm từ mốc nào. Và
giảm giá trừ vào dòng hay vào hoá đơn — chọn dòng, để thuế tính trên gốc đã giảm.

**Xong khi.** Một coupon giảm 20% trong 3 tháng trên một subscription sinh ra ba hoá đơn có dòng giảm
giá và một hoá đơn thứ tư không có, và báo cáo MRR phản ánh doanh thu sau giảm.

**Công sức: M.**

---

## Phase 15 — Thuế

**Mục tiêu.** Làm cho `taxBehavior` có nghĩa, và `tax_payable` bắt đầu có bút toán.

**Vì sao ở đây.** Cần cột thuế của phase 13 và thứ tự áp giảm giá của phase 14 (thuế tính trên gốc sau
giảm). [`ROADMAP.md`](ROADMAP.md) xếp việc này vào nghĩa vụ pháp lý (NĐ 123/2020, sửa bởi NĐ 70/2025),
nên với một triển khai nội bộ có xuất hoá đơn thì nó không phải tuỳ chọn, và nó đứng trên phần lớn công
việc "cho giống Stripe".

**Deliverables.** `tax_rates` (`percentage`, `inclusive`, `jurisdiction`, `country`/`state`, `taxType`,
`active`); bảng dòng thuế của line item; `defaultTaxRates` trên subscription và invoice; thuế suất
riêng cho từng item; `taxBehavior` **bắt đầu được đọc** ở bước ráp tổng; `customer.taxExempt`;
`tax_ids` thành object hạng nhất có `verification` và một worker verify (tạm để stub).
`automaticTax: { enabled, status }` dựng thành **interface provider** —
`TaxProvider.calculate(invoiceDraft) → taxAmounts` — với một cài đặt tra bảng. Ledger ghi `tax_payable`.

Tách bạch dứt khoát hai dãy số: `INV-000001` là dãy **nội bộ**, còn số có mã cơ quan thuế là của nhà
cung cấp. Thêm `authorityInvoiceNumber` và `authorityStatus` nullable để tích hợp hoá đơn điện tử sau
này là một adapter, không phải một migration. `ROADMAP.md` đã cảnh báo hai thứ này không được lẫn.

**Quyết định bị ép phải chốt.** Làm tròn thuế inclusive: thuế gộp phải tách ngược ra từng dòng và đó
là cỗ máy sinh lệch một đồng kinh điển — bắt buộc đi qua `money.allocate(weights)`. Và thuế tính lại lúc
finalize hay đóng băng lúc draft: đóng băng lúc finalize, lưu snapshot thuế suất xuống dòng, vì thuế
suất thay đổi theo thời gian.

**Xong khi.** Một hoá đơn VND thuế inclusive và một hoá đơn USD thuế exclusive đều cân, đều ghi
`tax_payable`, và void đảo đúng cả hai vế.

**Công sức: L.**

---

## Phase 16 — Vòng đời subscription

**Mục tiêu.** Subscription tự roll kỳ, tự hỏng, tự tạm dừng và tự huỷ — không cần test clock, không
còn trạng thái chết.

**Vì sao ở đây.** Cần `collectionMethod`, `autoAdvance` và `amountDue` của phase 13 để `past_due` có
định nghĩa, và cần Event store của phase 12. Phải xong **trước** SubscriptionSchedule (21) và Checkout
(20), vì cả hai đều ghi vào subscription. Đây cũng là cái bẫy viết lại thứ hai, vì chuyện danh tính của
item.

**Deliverables.**

- **Roll kỳ chạy thật.** `advanceSubscriptions` có caller thật: mở rộng billing workflow thành
  advance → ensure draft → auto-advance → thu. Hôm nay hàm này **chỉ** gọi được từ `TestClockService`,
  nên một subscription không gắn test clock **không bao giờ roll kỳ**, và billing run chỉ draft chứ
  không roll. Đây là lỗi sống nghiêm trọng nhất trong cả danh sách.
- `resolveNow` (dựng ở phase 10) luồn qua invoice, dunning, billing run và rating, để test clock điều
  khiển được cả đường ống chứ không riêng một service.
- **`past_due` và `unpaid` hết chết.** Dunning chuyển trạng thái subscription chứ không chỉ trạng thái
  hoá đơn; luật `unpaid → blocked` của entitlement do đó không còn là code chết. Thêm `incomplete` khi
  lần thu đầu hỏng và `incomplete_expired` sau 23 giờ.
- `paused` + `pauseCollection { behavior: keep_as_draft | mark_uncollectible | void, resumesAt }`.
- `cancelAt` (huỷ vào một ngày trong tương lai) + `cancellationDetails`;
  `trialSettings.endBehavior.missingPaymentMethod`.
- **SubscriptionItem thành resource hạng nhất**: `GET/POST/DELETE /v1/subscription_items`, diff thay
  vì `replaceSubscriptionItems` mint lại id cho cả bộ. Item id trở nên ổn định và tham chiếu được từ
  bên ngoài — phải làm trước khi có thứ gì ngoài hệ này lưu item id.
- `defaultPaymentMethod` thành cột thật trên customer và subscription, bỏ
  `metadata.defaultPaymentMethod` và fallback `pm_card_ok` đang hardcode. Tạm là text nullable; phase
  18 biến nó thành khoá ngoại thật.

**Quyết định bị ép phải chốt.** Đổi quantity có giữ nguyên item id không — có. Nhưng giữ id mà vẫn
phải đóng một cửa sổ và mở một cửa sổ khác, nên bảng cửa sổ phải tách khỏi bảng item:
[ADR 0013](adr/0013-arrears-proration.md) đã gọi tên lối thoát là `subscription_item_changes` —
lấy nó ở đây, đừng chất thêm lên `billedFrom`/`billedThrough`. Và `past_due` làm gì với entitlement:
chặn ngay, hay có thời gian ân hạn.

**Xong khi.** Một subscription không gắn test clock tự roll kỳ, draft, finalize, thu, hỏng, sang
`past_due`, hết lịch dunning, sang `unpaid`, và mất entitlement — chỉ nhờ đồng hồ thật và worker.

**Công sức: XL.**

---

## Phase 17 — Bill in advance

**Mục tiêu.** Thu **trước** kỳ như Stripe, thay vì thu sau kỳ như hiện nay.

**Vì sao ở đây.** Đây là điểm lệch hành vi lớn nhất giữa pinstripe và Stripe, và nó không nằm trong
danh sách "thiếu tính năng" nào cả — nó là một lựa chọn mô hình.
[ADR 0013](adr/0013-arrears-proration.md) ghi rõ: hệ này bill in arrears, hoá đơn phủ kỳ vừa kết thúc.
Stripe bill in advance. Phải xếp sau phase 16 vì cần vòng đời roll kỳ đã đúng trước khi đổi mốc phát
hoá đơn.

Hệ quả dây chuyền, và đây là lý do nó là XL chứ không phải M:

- Hoá đơn phát lúc **bắt đầu** kỳ, với `billingReason = subscription_create` cho kỳ đầu — một member
  mà ADR 0013 nói thẳng là "khái niệm của advance billing, hệ này không xuất gì lúc tạo".
- Đổi giữa kỳ sinh **credit âm**: khách đã trả trọn kỳ nên phải hoàn phần chưa dùng của giá cũ rồi thu
  phần còn lại của giá mới. `RatingLine.isCredit` đã có sẵn trong engine và có unit test, nhưng **chưa
  có producer nào trong code sản phẩm** — nó được để lại đúng cho phase này.
- `GET /v1/invoices/upcoming` đổi nghĩa: từ "kỳ đang chạy sẽ tính bao nhiêu" thành "kỳ tới sẽ thu bao nhiêu".
- Ba cột `billedFrom` / `billedThrough` / `invoicedThrough` đổi cách diễn giải, và `always_invoice`
  không còn bị giới hạn ở cửa sổ đã đóng.
- Usage-based vẫn bill in arrears kể cả ở Stripe — nên một subscription sẽ có hai chế độ cùng lúc, và
  đó là phần khó nhất.

**Lựa chọn thay thế, phải cân nhắc trước khi bắt đầu.** Chốt ở lại arrears và viết một ADR nói rõ đây
là lệch có chủ ý. Rẻ hơn nhiều và không sai về nghiệp vụ. Nhưng khi đó bản clone dạy một mô hình khác
với Stripe ở đúng chỗ dễ gây hiểu nhầm nhất. Vì mục tiêu số một của dự án là **hiểu Stripe vận hành thế
nào**, khuyến nghị là làm — và giữ arrears như một chế độ song song cho usage.

**Quyết định bị ép phải chốt.** `billingMode` là thuộc tính của price, của subscription, hay của cả hệ.
Và proration credit đi vào hoá đơn kế tiếp hay sinh hoá đơn tức thì.

**Xong khi.** Tạo một subscription phát hoá đơn ngay với `billingReason = subscription_create`; đổi gói
giữa kỳ sinh một dòng credit âm và một dòng thu dương cân đúng tỷ lệ thời gian; item metered vẫn bill
sau kỳ trên cùng subscription đó.

**Công sức: XL.**

---

## Phase 18 — Mô hình payment

**Mục tiêu.** Phía thanh toán thôi là một chuỗi string và bắt đầu là Stripe.

**Vì sao ở đây.** Cái bẫy viết lại thứ ba, và xếp muộn có chủ ý: nó cần `invoiceId` nullable cùng bảng
`invoice_payments` của phase 13, cần Event store và verify chữ ký có tolerance của phase 12, và cần
reaper của phase 10. Làm sớm hơn là làm hai lần.

**Deliverables.**

- Bảng `payment_methods`: `type` (card / bank / wallet), `card { brand, last4, expMonth, expYear,
fingerprint, funding, country }`, `billingDetails`, `customerId` nullable. Attach / detach / list /
  update. Mọi cột `paymentMethod text` trở thành khoá ngoại.
- `setup_intents` và luồng SetupIntent — lưu thẻ mà không thu tiền. Điều kiện trước của Checkout và
  portal ở phase 20.
- `charges` thành object thật: `amount`, `captured`, `balanceTransactionId`, `outcome`,
  `paymentMethodDetails`, `failureCode` / `declineCode`, refund. `payment_attempts` trở thành nhật ký
  thử phía sau nó, hoặc gộp vào.
- PaymentIntent đủ trạng thái: `processing`, `requires_action` (3DS/SCA với `nextAction`),
  `requires_capture` (tách auth và capture, `captureMethod`, `POST /capture`), lý do khi `canceled`;
  và PaymentIntent **độc lập**, không gắn hoá đơn.
- **Callback bất đồng bộ**: route dưới `/api/v1/system/*` — hôm nay chỉ có `/ping` — verify chữ ký có
  tolerance, idempotent theo `(provider, eventId)`, lái state machine của intent. Chạy trên mock PSP;
  PSP thật để phase 24.
- Taxonomy `declineCode` map từ mã của PSP. **Smart retry** thay lịch delay cố định: lịch thử lại phụ
  thuộc `declineCode`, hard decline không thử lại. Dunning viết lại trên nền intent ổn định.
- `NotificationQueue` được cài đặt thật — hôm nay là một cái tên. Cần `smtp.client.ts` (env đã khai
  `SMTP_HOST`/`SMTP_PORT` nhưng `packages/core/src/clients/` chỉ có `mock-psp.client.ts`), một plugin,
  template, và worker notification. Mailpit đã có sẵn trong `docker/compose.yml`.

**Quyết định bị ép phải chốt.** Mặc định confirm đồng bộ hay bất đồng bộ — chọn bất đồng bộ; chính giả
định đồng bộ trong `confirmPaymentIntent` hiện tại là thứ tạo ra khe hở hai transaction trong
[PITFALLS §4](PITFALLS.md#4-trạng-thái-kẹt-không-tự-thoát). Và dữ liệu thẻ: chỉ token, không bao giờ
số thẻ — ghi vào ADR.

**Xong khi.** Một thẻ cần 3DS ra `requires_action`, hoàn tất qua callback, sinh một Charge, áp vào hoá
đơn **đúng một lần** dù callback bị gửi trùng, và một hard decline không bị thử lại.

**Công sức: XL.**

---

## Phase 19 — Dòng tiền

**Mục tiêu.** Phía quỹ của sổ cái — PSP đang giữ bao nhiêu, đã chuyển về bao nhiêu, bị đòi lại bao nhiêu.

**Vì sao ở đây.** Cần Charge của phase 18. Phase này thêm tài khoản sổ cái mới, mà thêm mã tài khoản là
thao tác cộng thêm an toàn — không phải restate — nên xếp sau khi bộ tài khoản đã ổn định ở 13 và 15.

**Deliverables.** `balance_transactions` (gross, fee, net, type, `availableOn`, source);
`GET /v1/balance` (available / pending / reserved); `payouts` + worker + event `payout.paid/failed`;
`disputes` (+ evidence, event `dispute.created/closed`, bút toán rút tiền, phản ứng lên subscription và
entitlement). Refund chuyển về cấp Charge, hỗ trợ nhiều lần refund và `refund.updated`. Credit note
hoàn chỉnh: dòng chi tiết, `pre_payment` / `post_payment`, liên kết refund, void, `outOfBandAmount`.
Tài khoản mới: `psp_receivable`, `psp_fees`, `disputes_held`, `payouts_clearing`. Reconciliation v2:
phân trang (hôm nay `SCAN_LIMIT = 1000` âm thầm bỏ dòng) và đối chiếu ba chiều invoice ↔ ledger ↔ PSP.

**Cảnh báo kiến trúc.** `refunds` và `credit_notes` đang bị trigger chặn UPDATE/DELETE. Refund có
status chuyển được và credit note void được đều đụng vào đó — hoặc bỏ trigger, hoặc tách một bảng
attempt như `payment_attempts` đã làm. Chọn cách thứ hai để giữ tính append-only.

**Quyết định bị ép phải chốt.** Tiền có thực sự đi qua số dư của PSP, hay thẳng về tài khoản ngân hàng.
Nếu thẳng về ngân hàng thì Payout là một object báo cáo chứ không phải một cỗ máy chuyển tiền — mô hình
hoá nó, đừng tự động hoá nó.

**Xong khi.** Với một ngày hoạt động: Balance = tổng balance transaction = cash + `psp_receivable` trên
sổ; và một dispute cùng bút toán đảo của nó về đúng không.

**Công sức: L.**

---

## Phase 20 — Bề mặt khách

**Mục tiêu.** Những phần một con người thật chạm vào.

**Vì sao ở đây.** Mọi thứ trong phase này cần PaymentMethod và SetupIntent (18), giảm giá và thuế
(14/15), và publishable key (11). Riêng **portal auth là lỗ bảo mật ngay hôm nay** — biết `customerId`
là đọc được hoá đơn của khách đó ([PITFALLS §7](PITFALLS.md#7-bảo-mật--ba-thứ-chặn-production)). Nếu
cần mở portal ra trước phase 18, **kéo riêng phần auth** lên phase 11; đừng kéo Checkout lên theo.

**Deliverables.** Portal magic-link + session + một tầng API riêng cho portal dùng publishable hoặc
session key thay `SECRET_API_KEY`. `billing_portal.configurations` + `billing_portal.sessions`.
`checkout.sessions` (mode `payment | subscription | setup`, `lineItems`, `successUrl` / `cancelUrl`,
worker hết hạn, event `checkout.session.completed`) và trang hosted của nó. `payment_links`.
`hostedInvoiceUrl` + `invoicePdf` (renderer + object storage) + email `invoice.sent`. admin-ui có
đường xác thực thật thay cho vite dev proxy — build production hiện không có proxy đó.

**Quyết định bị ép phải chốt.** Checkout session là một **state machine có hạn dùng**, không phải một
cái form: nó không được giữ chỗ gì, và chỉ tạo subscription khi hoàn tất. Và PDF lưu ở đâu, URL hosted
sống bao lâu.

**Công sức: XL** (riêng Checkout đã là L).

---

## Phase 21 — SubscriptionSchedule

**Mục tiêu.** Phase, ngưỡng, và các nguyên thuỷ lập lịch.

**Vì sao ở đây.** Một schedule là cỗ máy **lái** các lần update subscription; nó cần item id ổn định
(16), cần giảm giá và thuế (14/15) để mô tả được từng phase, và cần proration đúng. Dựng trước 16 là
dựng để viết lại.

**Deliverables.** `subscription_schedules` + `subscription_schedule_phases` (items, coupon, tax rate,
`iterations`, `prorationBehavior`, `endBehavior: release | cancel`), worker advance, event
`subscription_schedule.*`. `billingThresholds` (theo số tiền và theo usage) với `billingReason =
subscription_threshold` và một hook kiểm ngưỡng trong metering. `proration_date`, `backdateStartDate`,
ngữ nghĩa reset `billingCycleAnchor`.

**Quyết định bị ép phải chốt.** Chuyển phase có đi qua **đúng code path của `updateSubscription`**
không — có; nếu không thì proration tách thành hai bản cài đặt và sẽ lệch nhau. Kiểm ngưỡng là
eventually-consistent theo metering, nên phải công bố độ trễ hợp đồng là bao nhiêu.

**Công sức: L.**

---

## Phase 22 — Catalog fidelity

**Mục tiêu.** Phần bề mặt price và product còn lại.

**Vì sao ở đây.** Thuần cộng thêm, và đa tiền tệ dễ hơn khi `livemode` và mô hình tổng đã yên.

**Deliverables.** Bảng con `price_currency_options` — hôm nay `prices.currency` là một cột đơn, nên đổi
cái này ép phải trả lời "subscription bill bằng đồng nào". `customUnitAmount`. `aggregateUsage`
(`sum` / `last_during_period` / `last_ever` / `max`) trong rating. `shipping_rates` + dòng shipping
trên hoá đơn. `product.defaultPrice`, `product.features`. `Feature` + `ProductFeature` (entitlement v2)
thay cho luật entitlement hiện suy ra từ price.

Chốt số phận `resolvePrice` / `findEffectivePrice`: hôm nay **không route nào, không caller nào**, nên
`effectiveAt` chưa quyết định gì. Hoặc nối chúng vào `defaultPrice` / `currencyOptions` ở đây, hoặc xoá
và đóng lại [technique 05](technique/05-product-and-price.md).

**Công sức: M.**

---

## Phase 23 — Search và vận hành

**Mục tiêu.** Bề mặt platform cuối cùng, và bằng chứng là nó chịu được tải.

**Deliverables.** Search API trên Postgres FTS/trigram với một projection tìm kiếm cho mỗi resource —
không bolt Elastic vào. Sinh OpenAPI từ schema TypeBox. Metrics và tracing. Load test hai nút thắt đã
biết: `claimNextNumber` serialize trên một dòng, và webhook fan-out. Runbook cho bảng trạng thái kẹt.

**Công sức: M.**

---

## Phase 24 — Thế giới thật (hoãn có chủ ý)

Chỉ mở khi công ty quyết thu tiền thật. PSP thật (VNPay, MoMo) lắp sau adapter và route callback đã
dựng ở phase 18. Nhà cung cấp hoá đơn điện tử lắp sau `authorityInvoiceNumber` đã chừa ở phase 15.
Cả hai đều là adapter, không cái nào là migration — đó là điểm của việc dựng khớp nối trước.

**Công sức: L.**

---

## Bốn cái bẫy: chỗ mà làm sai thứ tự phải viết lại

1. **Tổng hoá đơn và hợp đồng bút toán (phase 13).** `ledger_transactions` bị trigger chặn
   UPDATE/DELETE, và `invoice_line_items` append-only **kể cả khi hoá đơn còn draft**. Mỗi hoá đơn ghi
   sổ sai cách chia doanh thu là lịch sử vĩnh viễn, chỉ gỡ được bằng bút toán đảo từng cái một.
   `externalId` còn là hợp đồng ngầm bốn bên mà reconciliation đọc và không có test nào giữ.
   **Trả trước mọi coupon, mọi thuế suất, và trước production.**
2. **Danh tính SubscriptionItem (phase 16).** `replaceSubscriptionItems` mint id mới cả khi chỉ đổi
   quantity. Khi schedule (21) hay Checkout (20) bắt đầu lưu item id, churn này thành bug dữ liệu không
   sửa êm được. **Trả trước 20 và 21.**
3. **`paymentIntents.invoiceId NOT NULL` và PaymentMethod là string (phase 13 và 18).** Mọi đường đi
   trong payment service đang giả định intent ⇒ invoice, và `paymentMethod` là một chuỗi ma thuật đọc
   từ `customer.metadata`. Chia đôi chi phí: đổi nullable và thêm `invoice_payments` ở 13 (đằng nào
   cũng đang viết lại `payInvoice`), mô hình object ở 18. Cái phải tránh là làm phần nullable hai lần.
4. **`livemode` (phase 11).** Cùng hình dạng với một cột tenant: chạm mọi bảng, mọi unique index,
   `number_sequences`. Rẻ khi có ~20 bảng, đắt khi có ~40 sau phase 22.

Đáng nhắc thêm: `expand[]` ở phase 12 không phải viết lại, nhưng nó là một lần sửa 40 route — để muộn
thì thành một lần sửa 100 route.

## Những chỗ kiến trúc hiện tại sẽ chống lại

- `subtotal == total` ăn sâu vào cả `reporting.service.ts` (MRR/ARR) lẫn `reconciliation.service.ts`.
  Cả hai vỡ **âm thầm** ngay khi có giảm giá hoặc thuế.
- `invoiceLineItems.priceId NOT NULL`, không có `description` hay `unitAmount` — chặn về mặt cấu trúc
  cả `InvoiceItem`, dòng shipping, lẫn hoá đơn rời.
- `finalizeInvoice` bắt buộc có `subscriptionId`, kèm guard so khớp kỳ, và unique index thu hẹp theo
  `billingReason = 'subscription_cycle'`. Cả đường finalize đang mang hình dạng của subscription.
- Trigger immutability trên `invoices`, `invoice_line_items`, `credit_notes`, `refunds`,
  `payment_attempts`, và toàn bộ sổ cái.
- `LedgerAccountCodeEnum` là enum đóng — nhưng `deferred_revenue`, `tax_payable`, `rounding_difference`
  và `customer_credit_balance` đã khai và **chưa bút toán nào dùng**. Đó là giấy phép định nghĩa chúng
  cho đúng ngay lần dùng đầu tiên.
- Một cột `currency` cho mỗi price và mỗi subscription; reporting mặc định VND và âm thầm chỉ báo cáo
  đúng loại tiền đó; không có FX ở đâu cả. `currencyOptions` là một bảng con, không phải một cột.
- Rating trả về một `total` trần và làm tròn HALF_UP từng dòng — giảm giá và thuế bắt buộc đi qua
  `money.allocate(weights)`, nếu không tổng các dòng thôi bằng tổng hoá đơn
  ([PITFALLS §2](PITFALLS.md#2-tiền-và-làm-tròn)).
- `resolveNow` chỉ tồn tại trong `SubscriptionService`, nên mọi tính năng theo thời gian dựng thêm —
  schedule, smart retry, resume sau pause, hết hạn session — thừa hưởng một cái đồng hồ chạy trong test
  mà không chạy thật, hoặc ngược lại.
- `MockPspClient` giữ state in-memory theo process, nên refund xuyên process đã hỏng sẵn; Checkout và
  callback sẽ hỏng nặng hơn.
- `number_sequences` là một dòng serialize mọi lần finalize.
- Chưa có bảng `events`; payload của `outbox_events` là shape nội bộ, không có `apiVersion`.
- Idempotency cache cả response 4xx, `scope` hardcode `'default'`, và không bao giờ hết hạn;
  `webhook_deliveries` thiếu unique `(endpointId, eventId)` nên retry nhân đôi webhook gửi cho khách.

## Lỗi đã biết fix ở phase nào

Một phase dọn dẹp riêng (10) cho những lỗi thuần và **sẽ không bị viết lại**; phần còn lại gộp vào
phase sở hữu đoạn code đó. Một phase "sửa hết pitfall" đặt ở cuối sẽ phí công sửa đúng những dòng mà
phase 16 và 18 xoá đi.

| Lỗi                                                       | Fix ở                                       |
| --------------------------------------------------------- | ------------------------------------------- |
| `payInvoice` read-modify-write không khoá dòng            | 10                                          |
| Dunning charge trùng khi job retry                        | 10 (chặn máu), 18 (làm đúng)                |
| Reaper cho outbox / test clock / webhook delivery kẹt     | 10                                          |
| Idempotency không hết hạn, cache 4xx                      | 10; `scope` ở 11                            |
| `isWebhookSignatureValid` không có tolerance              | 10 — điều kiện trước của 18                 |
| Webhook delivery trùng khi retry                          | 10 (một unique index)                       |
| Entitlement không bị thu hồi khi gỡ product               | 10 (vá), 22 (viết lại theo Feature)         |
| `MockPspClient` in-memory, lỗi không phải `AppError`      | 10                                          |
| `advanceSubscriptions` không caller; `past_due` chết      | 16                                          |
| `resolveNow` chỉ có trong `SubscriptionService`           | helper ở 10, luồn đi ở 16                   |
| `customers.balance` chưa ai ghi                           | 13                                          |
| `deferred_revenue` / `rounding_difference` chưa dùng      | 13 và 15                                    |
| `taxBehavior` chưa ai đọc; `tax_payable` chưa ghi         | 15                                          |
| `WEBHOOK_SIGNING_SECRET` chưa ai đọc                      | 12 (dùng, hoặc xoá khỏi env schema)         |
| Reconciliation `SCAN_LIMIT` cắt âm thầm                   | 19                                          |
| `refunds` / `credit_notes` append-only cản status và void | 19                                          |
| `NotificationQueue` rỗng                                  | 18                                          |
| portal-ui không auth; admin-ui chỉ có vite proxy          | 20 (kéo riêng portal auth lên 11 nếu cần)   |
| `resolvePrice` / `findEffectivePrice` không caller        | 22 (nối vào, hoặc xoá)                      |
| `apps/api` và `apps/worker` không có test                 | 10 dựng lưới; mỗi phase sau mang test riêng |
| ~30 negated guard, nợ tên method                          | gộp vào phase nào đụng file đó              |

## Hai quy ước xuyên suốt

**Viết ADR theo từng phase, ngay khi phase đó land** — đúng như phase 0–9 đã làm. Phase 13, 16, 17 và
18 mỗi cái đáng hai ADR: một cho data model, một cho state machine. Đó là bốn quyết định sẽ cần đọc lại
sau một năm, mà đọc lại được chính là mục đích của dự án này.

**Không xếp một "phase test" ở cuối.** Phase 10 dựng lưới; mỗi phase sau ship test của chính nó. Nợ
test là thứ [`ROADMAP.md`](ROADMAP.md) đã phải ghi lại một lần rồi.
