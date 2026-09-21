# Cạm bẫy — khi phát triển và khi test

Đây là billing system, nên phần lớn lỗi **không crash mà ra sai số**. File này gom những chỗ code
chạy đúng về mặt kỹ thuật nhưng sai về mặt tiền, cùng những chỗ test xanh mà chẳng chứng minh gì.

[`usecases/`](usecases/00-index.md) nói **một kịch bản diễn ra thế nào**, [`flows/`](flows/00-index.md)
nói **cơ chế chạy thế nào**, [`adr/`](adr/) nói **tại sao chọn cách đó**; file này nói **chỗ nào dễ
tự bắn vào chân**. Mỗi mục trỏ thẳng vào `file:line` để kiểm chứng.

## Bảng tra nhanh

| Bạn định làm gì                 | Đọc mục                                                                   |
| ------------------------------- | ------------------------------------------------------------------------- |
| Viết service mới có ghi dữ liệu | [1](#1-bốn-quy-tắc-phá-là-hỏng-âm-thầm), [8](#8-concurrency)              |
| Đụng vào tiền, giá, rating      | [2](#2-tiền-và-làm-tròn)                                                  |
| Đụng vào sổ cái hoặc hoá đơn    | [3](#3-sổ-cái-và-hợp-đồng-ngầm-externalid)                                |
| Debug "sao event không ra"      | [4](#4-trạng-thái-kẹt-không-tự-thoát), [5](#5-idempotency-bảo-vệ-đến-đâu) |
| Debug "sao cái này không chạy"  | [6](#6-code-chết-và-nửa-vời)                                              |
| Đưa lên môi trường thật         | [7](#7-bảo-mật--ba-thứ-chặn-production)                                   |
| Dựng máy, chạy lần đầu          | [9](#9-bẫy-môi-trường-phát-triển)                                         |
| Viết test                       | [10](#10-lưu-ý-khi-test)                                                  |

---

## 1. Bốn quy tắc, phá là hỏng âm thầm

Bốn quy tắc ở [flows/00](flows/00-index.md) là nền của mọi thứ. ESLint bắt được một phần; phần còn
lại không có gì chặn.

| Quy tắc                                                | Phá ra sao                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Thời gian luôn qua `fastify.clock`, không `new Date()` | test clock mất tác dụng ở nhánh đó; bug chỉ lộ khi chạy thật |
| Ghi dữ liệu và ghi outbox trong **cùng** transaction   | dual-write: dữ liệu đổi mà event không bao giờ ra            |
| `find*` trả `null`, `get*` ném lỗi                     | `null` lọt xuống dưới, ra `NaN` hoặc 0 đồng thay vì 404      |
| Tiền là số nguyên minor unit, đi qua `Money`           | float → sai lệch lẻ, không test nào bắt                      |

Quy tắc số 2 có một cái bẫy cụ thể đáng gọi tên. `recordEvents(events, executor)` nhận `executor`
tuỳ chọn, và repository fallback về connection chính khi không có —
[outbox-event.repository.ts:44](../packages/platform/src/repositories/outbox-event.repository.ts):

```ts
const db: Database | DatabaseTransaction = executor ?? this._db.master;
```

Quên truyền `tx` thì **không lỗi biên dịch, không lỗi lint, không lỗi runtime** — chỉ là outbox ghi
ngoài transaction, và nghiệp vụ rollback thì event vẫn đi ra. Đây là lỗi tốn nhiều thời gian nhất để
tìm trong toàn bộ codebase.

## 2. Tiền và làm tròn

- `Money.multiply` và `Money.fromMajorUnit` **bắt buộc** truyền `RoundingPolicy` —
  [money.ts](../packages/modules/billing/src/utils/money.ts). Chọn bừa là đổi số tiền khách trả.
- Rating làm tròn **một lần mỗi dòng** rồi mới cộng (`HALF_UP` —
  [rating.ts:14](../packages/modules/billing/src/utils/rating.ts)). Đổi thứ tự thành cộng-trước-làm-tròn-sau thì
  tổng hoá đơn không còn bằng tổng các dòng hiển thị.
- Chia tiền ra nhiều phần phải dùng `Money.allocate` (largest-remainder). Tự `Math.round` từng phần
  là mất hoặc thừa đồng lẻ.
- Cột tiền là `bigint` trong Postgres nhưng `number` trong JS. Trần thật là `Number.MAX_SAFE_INTEGER`
  (~9.0e15), và `Money.of` ném `BadRequestError` khi vượt.
- VND, JPY, KRW có exponent **0** — [currency.ts](../packages/modules/billing/src/utils/currency.ts). Đừng nhân
  chia 100 theo phản xạ.
- `meter_events.value` là `double precision` — đó là **lượng dùng**, không phải tiền.
- Không có chuyển đổi tỷ giá ở bất kỳ đâu. Reporting mặc định `VND` và lặng lẽ chỉ báo cáo đúng
  currency đó.
- Rating chỉ nhìn item qua **cửa sổ tính tiền** (`billed_from` / `billed_through` /
  `invoiced_through`), không qua `deleted_at`. Một row soft-delete mà `billed_through` còn `NULL`
  đọc thành cửa sổ mở và bị bill **trọn kỳ, mãi mãi** — đó là lý do migration `0015` backfill
  `billed_through = deleted_at` và có `CHECK` ép hai cột đi cùng nhau.
- Void một hoá đơn `billing_reason = subscription_update` **phải** clear `invoiced_through` của các
  item nó phủ. Thiếu bước đó là mất vĩnh viễn khoản ấy: lát đã đóng dấu đã xuất hoá đơn và không gì
  bill lại — [invoice.service.ts](../packages/modules/billing/src/services/invoice.service.ts),
  [ADR 0013](./adr/0013-arrears-proration.md).
- `prorationBehavior: none` trên một item **metered** bỏ hẳn usage của kỳ khi item thay thế trỏ
  **meter khác**. Cùng meter thì không mất gì. Đây là đánh đổi có chủ ý, không phải lỗi.
- Mọi cột thời gian đọc ra là **ISO string**, không phải `Date`
  ([ADR 0021](./adr/0021-iso-timestamps-and-no-object-field.md)). Cần tính kỳ, so khoảng thì
  `new Date(row.x)` trước. So sánh chuỗi (`a < b`) chỉ đúng khi cả hai vế đều do `toISOString()`
  sinh ra: UTC, hậu tố `Z`, đủ 3 chữ số millisecond. Một chuỗi từ client hoặc từ raw SQL phải parse
  và đổi lại trước khi so.
- Raw SQL (`db.execute`) và `sql<…>` tự viết **không** đi qua `isoTimestamp.fromDriver`, nên nhận
  chuỗi thô của driver (`2026-09-18 10:00:00.123456+00`). Tự chuẩn hoá ở repository.

## 3. Sổ cái và hợp đồng ngầm `externalId`

Sổ cái được bảo vệ rất chặt ở tầng DB: trigger `0003_ledger_immutability` chặn UPDATE/DELETE, số dư
là **view** chứ không phải cột, `assertBalanced` chặn bút toán lệch. Sửa sai **chỉ** bằng
`reverseTransaction`, và bản đảo phải `externalId = null`
([ledger.service.ts:226](../packages/modules/billing/src/services/ledger.service.ts)) nếu không đụng unique
index bản gốc.

Chỗ yếu không nằm ở đó. Chống ghi sổ hai lần dựa **hoàn toàn** vào unique index trên `external_id`,
mà định dạng chuỗi đó là một hợp đồng ngầm giữa bốn nơi:

| Chuỗi                               | Sinh ở                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `invoice:<id>`                      | [invoice.service.ts](../packages/modules/billing/src/services/invoice.service.ts) `postReceivable`    |
| `invoice_payment:<id>:<amountPaid>` | [invoice.service.ts](../packages/modules/billing/src/services/invoice.service.ts) `postCashReceipt`   |
| `invoice_void:<id>`                 | [invoice.service.ts](../packages/modules/billing/src/services/invoice.service.ts) `reverseReceivable` |
| `payment_intent:<id>`               | [payment.service.ts](../packages/modules/billing/src/services/payment.service.ts)                     |
| `refund:<id>`                       | [refund.service.ts](../packages/modules/billing/src/services/refund.service.ts)                       |

và được **đọc lại** bởi
[reconciliation.service.ts](../packages/modules/billing/src/services/reconciliation.service.ts) để so khớp.

> Đổi định dạng ở một nơi là làm hỏng đối chiếu ở nơi kia — **và không có test nào bắt được.**

Worker ledger chỉ **báo động, không tự sửa**
([ledger-integrity-check.processor.ts](../apps/worker/src/workflows/processors/ledger-integrity-check.processor.ts)).
Log mức `error` kèm `transactionIds` là thứ phải có người nhìn.

## 4. Trạng thái kẹt không tự thoát

| Nơi                  | Kẹt gì                                                                                                                                                | Gỡ bằng tay                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `outbox_events`      | relay chết sau khi claim → hàng kẹt `publishing`, **không có reaper**                                                                                 | đặt lại `status = 'pending'`   |
| `outbox_events`      | đẩy job lỗi → `failed`, không tự retry                                                                                                                | đặt lại `status = 'pending'`   |
| `test_clocks`        | chết giữa advance → `frozenTime` đã nhảy, `status` kẹt `advancing`; mọi advance sau đó 409                                                            | đặt lại `status = 'ready'`     |
| `payment_intents`    | confirm để intent ở `processing` rồi callback không bao giờ đến — intent kẹt `processing`, hoá đơn chờ tới `DUNNING_IN_FLIGHT_TIMEOUT_MS` mới thử lại | dunning tự thử lại sau timeout |
| `webhook_deliveries` | hết `WEBHOOK_MAX_ATTEMPTS` → job nằm ở failed set, không có dead-letter, không có đường replay                                                        | thao tác trực tiếp trên queue  |

Chi tiết ở [flows/02](flows/02-event-pipeline.md), [flows/07](flows/07-payments-and-refunds.md),
[flows/12](flows/12-test-clock.md).

Lưu ý ở `test_clocks`: nhánh xử lý lỗi khôi phục `status` nhưng **không** khôi phục `frozenTime` — sau
một lần advance hỏng, đồng hồ đã ở mốc mới còn subscription thì chưa được roll.

## 5. Idempotency bảo vệ đến đâu

Ba giới hạn cần biết trước khi tin vào nó:

1. **Không gửi header thì không có bảo vệ gì.** `idempotencyPlugin` chỉ chạy khi method là
   POST/PUT/PATCH/DELETE **và** có header `idempotency-key` —
   [idempotency.plugin.ts](../apps/api/src/plugins/idempotency.plugin.ts).
2. **Response 4xx cũng bị cache.** `onSend` gọi `completeRequest` cho mọi status dưới 500. Client sửa
   payload rồi thử lại với cùng key sẽ nhận `IdempotencyConflictError` mãi mãi, không bao giờ chạy
   được lệnh đã sửa.
3. **Hàng không bao giờ hết hạn.** `deleteExpiredRequests` tồn tại ở
   [idempotency.service.ts:90](../packages/platform/src/services/idempotency.service.ts) nhưng **không có
   caller nào** trong toàn repo. Tiến trình chết giữa request để lại hàng `in_progress` vĩnh viễn, và
   key đó nhiễm độc từ đó trở đi — không có đường reclaim theo `lockedAt`.

Thêm: `scope` đang hardcode `'default'`, nên hai caller không liên quan dùng trùng key trên cùng route
sẽ nhận **response đã cache của nhau**. ADR 0001 §8 ghi nhận đây là chỗ giữ sẵn cho tới khi có account.

Ở tầng sau, mọi thứ downstream outbox là **at-least-once**. Consumer phải tự idempotent, và có chỗ
chưa: `handleDomainEvent` sinh id mới cho mỗi hàng delivery rồi mới enqueue —
[webhook.service.ts:150-172](../packages/platform/src/services/webhook.service.ts). `webhook_deliveries`
không có unique index trên `(endpoint_id, event_id)`, nên job domain-event retry là **tạo thêm một bộ
delivery mới** cho cùng event. Khách nhận webhook trùng.

## 6. Code chết và nửa vời

Những thứ sau đã khai báo nhưng chưa ai gọi. Sửa một cái là phải sửa cả cụm, không vá lẻ.

| Thứ                                       | Tình trạng                                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `advanceSubscriptions`                    | chỉ được gọi từ [test-clock.service.ts:96](../packages/modules/billing/src/services/test-clock.service.ts) — **subscription không gắn test clock không bao giờ được roll kỳ tự động**                   |
| `WEBHOOK_SIGNING_SECRET`                  | `Type.String({ minLength: 16 })` ở [env.schema.ts](../packages/platform/src/config/env.schema.ts), thiếu là không boot — nhưng **không code nào đọc**. Webhook đi ra ký bằng `secret` của từng endpoint |
| `isWebhookSignatureValid`                 | chỉ dùng trong test. Chưa route nào verify chữ ký vào, vì `/api/v1/system/*` mới có `/ping`                                                                                                             |
| `deleteExpiredRequests`                   | không caller — xem [mục 5](#5-idempotency-bảo-vệ-đến-đâu)                                                                                                                                               |
| `RedisNamespaceEnum.BILLING_RUN_LOCK`     | khai báo, không dùng                                                                                                                                                                                    |
| `NotificationQueue`                       | một cái tên. Dunning thử thu lại nhưng không báo gì cho khách                                                                                                                                           |
| `deferred_revenue`, `rounding_difference` | tài khoản đã khai, chưa bút toán nào dùng (`tax_payable` có bút toán từ phase 15)                                                                                                                       |
| `taxBehavior` trên price                  | phase 15 đọc nó ở bước ráp tổng: inclusive/exclusive của price thắng cờ `inclusive` của tax rate                                                                                                        |
| `resolvePrice` / `findEffectivePrice`     | không route, không caller. Subscription và rating resolve theo `price_id`, nên `effective_at` chưa quyết định gì — [technique 05](technique/05-product-and-price.md)                                    |

Hai khoảng trống về hành vi:

- **Dunning đổi trạng thái hoá đơn, không đụng subscription.** Không chỗ nào chuyển sang `past_due`
  hay `unpaid`, nên hai nhánh đó của máy trạng thái và luật chặn entitlement khi `unpaid` là code
  chết — [flows/09](flows/09-dunning.md).
- **Entitlement không bao giờ bị thu hồi khi bỏ bớt sản phẩm.** `handleSubscriptionChanged` upsert
  theo các price **hiện tại**, không đụng tới entitlement của sản phẩm đã gỡ khỏi subscription —
  [entitlement.service.ts:59-70](../packages/modules/billing/src/services/entitlement.service.ts).
  `replaceSubscriptionItems` thay cả bộ item, nên gỡ một item là để lại entitlement `active` mồ côi.
  Khái niệm và vì sao bảng này tồn tại: [technique 04](technique/04-entitlement.md).

Ngoài ra `isWebhookSignatureValid` **không có cửa sổ dung sai thời gian** — nó tính lại HMAC bằng đúng
`t` mà bên gọi gửi lên, nên một payload bắt được replay được vĩnh viễn. Phải thêm tolerance trước khi
mở route callback PSP thật.

## 7. Bảo mật — ba thứ chặn production

1. **billing-portal-ui không xác thực.** `app/customers/[customerId]/page.tsx` không kiểm tra người xem là ai;
   biết `customerId` là đọc được hoá đơn và subscription của khách đó. **Không được đưa ra internet ở
   dạng hiện tại** — [flows/13](flows/13-frontend-data-flow.md), [ADR 0012](adr/0012-phase-9-portal-reporting.md).
2. **erp-ui không có đường xác thực thật.** API key được vite dev proxy gắn vào; build production
   không có proxy.
3. **Webhook chưa rate limit theo endpoint.** Một đợt relay lớn dội thẳng vào endpoint của khách —
   [ADR 0011](adr/0011-phase-8-dunning-webhooks.md).

Và một điều kiện nền: **không có tenant isolation.** Không có cột tenant/organization ở đâu cả. Cô lập
chỉ là bốn API key phẳng theo nhóm route. Ai cầm `SECRET_API_KEY` là đọc được dữ liệu của mọi khách.

## 8. Concurrency

Những chỗ **đã** an toàn, đừng phá: outbox claim bằng `FOR UPDATE SKIP LOCKED`; billing run shard theo
`hashtext(subscriptions.id)`; dunning shard theo `invoices.customerId` (mọi hoá đơn của một khách vào
cùng shard, nên không có hai shard cùng quẹt thẻ một khách); `jobId` của BullMQ; `ensureDraftInvoice`
bắt unique violation rồi đọc lại; unique index là lớp chốt cuối ở khắp nơi.

Những chỗ **chưa** an toàn:

- **`payInvoice` là read-modify-write không khoá hàng** —
  [invoice.service.ts:188-239](../packages/modules/billing/src/services/invoice.service.ts). Đọc `amountPaid`
  **ngoài** transaction, cộng thêm, rồi UPDATE giá trị tuyệt đối **trong** transaction. Hai lần trả
  một phần chạy song song là mất một lần. Nếu hai số tiền bằng nhau thì unique index trên
  `invoice_payment:<id>:<amountPaid>` tình cờ cứu được; số tiền khác nhau thì cả hai cùng vào sổ mà
  `amountPaid` chỉ ghi nhận một — sổ cái và hoá đơn lệch nhau.

- **Dunning có thể quẹt thẻ hai lần khi job retry.** `collectInvoice` tạo **payment intent mới** mỗi
  lần thử ([dunning.service.ts:81-86](../packages/modules/billing/src/services/dunning.service.ts)), mà
  idempotency key gửi cho PSP là `charge:<paymentIntentId>`. Nên bảo vệ ở tầng PSP **không** bắc qua
  được các lần retry: charge thành công rồi lỗi trước khi cập nhật hoá đơn → BullMQ retry → intent
  mới, key mới, trừ tiền lần nữa.

  Vòng lặp shard cũng **không** bọc `try/catch` từng hoá đơn
  ([dunning.service.ts:52-56](../packages/modules/billing/src/services/dunning.service.ts)) — một hoá đơn ném lỗi
  là cả job retry.

  (Lưu ý: [flows/07](flows/07-payments-and-refunds.md) viết rằng dunning dùng lại cùng một intent.
  Code không như vậy.)

- **`claimNumberSequence` xếp hàng mọi lần finalize.** Là `UPDATE ... RETURNING` trên **một hàng**
  `number_sequences` bên trong transaction finalize —
  [invoice.repository.ts:97-108](../packages/modules/billing/src/repositories/invoice.repository.ts). Dãy số
  liên tục là yêu cầu kế toán, nhưng đây là điểm nghẽn phải biết trước khi đo tải. Rollback thì trả
  lại số, nên không có lỗ hổng số.

- **Entitlement luôn chậm hơn một nhịp.** Nó được ghi bởi worker domain-event, không bao giờ trong
  request. Tạo subscription rồi đọc entitlement ngay là đua với `OUTBOX_RELAY_INTERVAL_MS` (mặc định
  5000ms). Cache TTL 300s và `GET /v1/entitlements` **không** đi qua cache còn `getEntitlementStatus`
  thì có — hai đường có thể trả lời khác nhau.

- **Reconciliation đã phân trang từ phase 19** (`PAGE_SIZE = 200`, con trỏ `(createdAt, id)`), nên
  `SCAN_LIMIT = 1000` cắt cụt âm thầm không còn. Đổi lại, phía sổ cái chỉ đọc `psp_receivable` +
  `psp_fees`: một bút toán tiền mặt ngoài luồng (`payInvoice` không qua charge) **không** xuất hiện
  trong báo cáo đối chiếu — [reconciliation.service.ts](../packages/modules/billing/src/services/reconciliation.service.ts).

## 9. Bẫy môi trường phát triển

| Bẫy                                                                                   | Triệu chứng                                                                                                                      |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `packages/platform` / `packages/modules/*` chạy từ `dist`, và `tsup` có `clean: true` | sửa package rồi chạy một package lẻ → vẫn là code cũ. `pnpm dev` / `turbo` lo thứ tự, chạy tay thì không                         |
| `pnpm db:migrate` / `pnpm db:reset` nạp `.env` qua `tsx --env-file`                   | chạy `tsx apps/api/scripts/migrate-database.ts` trần thì thiếu biến — dùng script pnpm                                           |
| Compose nằm ở `docker/compose.yml`                                                    | `docker compose up` trần không tìm thấy — dùng `pnpm docker:up`                                                                  |
| billing-portal-ui không đọc `.env` gốc                                                | cần `apps/billing-portal-ui/.env.local` riêng                                                                                    |
| Migration là journal                                                                  | **không xoá file đã generate** — nhiều migration là SQL viết tay (trigger, view, seed `number_sequences`)                        |
| Năm secret, mỗi cái ≥ 16 ký tự                                                        | thiếu một cái là app không boot — kể cả `WEBHOOK_SIGNING_SECRET` vốn không ai đọc                                                |
| `.env.example` thiếu mọi biến tinh chỉnh                                              | `OUTBOX_*`, `BILLING_RUN_*`, `DUNNING_*`, `WEBHOOK_*`, `INVOICE_DUE_DAYS`, `METER_DEDUP_WINDOW_DAYS` chỉ có default trong schema |
| Cổng cố định 55432 / 56379                                                            | checkout thứ hai của repo là đụng cổng                                                                                           |
| Worker cần `WORKFLOW_NAME`                                                            | giá trị lạ → `UnknownWorkflowError`                                                                                              |
| File viết bằng heredoc / `sed -i`                                                     | không load rule nào, không được format, và không có gì báo — xem [CLAUDE.md](../CLAUDE.md)                                       |

`MockPspClient` giữ toàn bộ state trong `Map` **trong bộ nhớ của từng tiến trình**
([mock-psp.client.ts](../packages/modules/billing/src/clients/mock-psp.client.ts)). Hệ quả:

- restart là mất sạch charge; refund sau đó ném `MockPspChargeNotFoundError`;
- charge do **worker dunning** tạo thì **API** không thấy → refund qua API ra lỗi;
- hai lỗi `MockPsp*Error` không phải `AppError` nên `errorHandlerPlugin` không nhận diện → **HTTP
  500** và message bị nuốt.

---

## 10. Lưu ý khi test

### 10.1 `pnpm test` xanh gần như không chứng minh gì

```
pnpm test → turbo run test
  ├─ @vxrerp/platform, @vxrerp/billing → vitest run   ← CHỈ unit test trong src/utils/
  ├─ @vxrerp/api    → vitest run --passWithNoTests   (0 test)
  ├─ @vxrerp/worker → vitest run --passWithNoTests   (0 test)
  └─ erp-ui, billing-portal-ui → không có script test, bị bỏ qua
```

`test:integration` **không phải turbo task và không được chain từ `test`**. Toàn bộ integration suite
trong `packages/platform/tests/`, `packages/modules/billing/tests/` và `apps/api/tests/` chỉ chạy khi gõ tay:

```bash
pnpm test:integration
```

CI chạy `pnpm test` sẽ báo xanh mà không hề chạm database.

Thêm: [`turbo.json`](../turbo.json) khai task `test` không có `inputs` và không `cache: false`, nên kết
quả bị cache. Với database ngoài, một lần "pass" đã cache có thể che một suite giờ đang fail.

### 10.2 Integration test chạy thẳng vào database dev

`tests/setup.ts` parse `.env` ở gốc repo và nhồi vào `process.env` — **ghi đè** biến shell, nên không
trỏ sang DB test bằng env bên ngoài được. `tests/context.ts` chỉ dựng Fastify headless với
`platformPlugin` (và `billingPlugin` ở billing), không `listen()`.

**Không truncate, không migrate step, không testcontainers.** Cô lập chỉ nhờ sinh ID và email mới mỗi
test; dữ liệu tích tụ vĩnh viễn. `ledger.integration.test.ts` ghi 1000 transaction mỗi lần chạy và cố
ý để lại một transaction hỏng để kiểm tra invariant.

Hai hệ quả phải nhớ:

- Mọi assert kiểu **tổng toàn bảng** (`reporting.`, `ledger.`) phụ thuộc lịch sử DB. Chạy sau một buổi
  nghịch tay bằng erp-ui là có thể đỏ.
- Test ghi vào **cùng namespace Redis** mà API dev đang dùng (`meter-dedup`, `entitlement`). Chạy
  `pnpm dev` song song với test là nhiễm chéo.

Reset thật sự chỉ có `pnpm docker:down` + xoá volume, rồi migrate lại.

`fileParallelism: false` được đặt chính vì các suite dùng chung một database — **đừng bật lên**.

### 10.3 Ba điều kiện tiên quyết, hỏng thì báo lỗi khó hiểu

1. `pnpm docker:up` — thiếu thì `ioredis` (`enableOfflineQueue: false`) và pool pg fail trong
   `beforeAll`, ra lỗi hook chứ không phải message rõ ràng.
2. `.env` ở gốc repo phải tồn tại — `readFileSync` không guard.
3. `pnpm db:migrate` phải chạy tay. Vừa `db:generate` migration mới mà quên migrate → fail vì schema cũ.

### 10.4 Test clock chỉ kiểm soát một service

`resolveNow` hiện **chỉ** có ở `SubscriptionService`
([subscription.service.ts:398-410](../packages/modules/billing/src/services/subscription.service.ts)). Invoice,
payment, dunning, billing run và metering luôn dùng giờ thật, kể cả với thực thể có `testClockId`.

| Muốn test                                  | Dùng được test clock?                                           |
| ------------------------------------------ | --------------------------------------------------------------- |
| roll kỳ, hết trial, huỷ subscription       | Có                                                              |
| `dueAt`, lịch retry dunning, cửa sổ rating | **Không** — luôn là giờ thật                                    |
| billing run                                | **Không** — nó dùng `clock.now()`, đẩy clock không sinh hoá đơn |
| metering                                   | **Không** — phải truyền `timestamp` tường minh                  |

Và sáu file test đều seed `CLOCK_START = Date.now() - 2 ngày`, tức **tương đối với giờ tường**, không
phải mốc cố định. Test chạy vắt qua ranh giới kỳ hoặc tháng có thể đổi hành vi. Repo **không** dùng
`vi.useFakeTimers()` ở đâu.

### 10.5 Đừng assert ngay sau khi ghi

Không có gì ngoài lời gọi service là đồng bộ. Entitlement chỉ có sau relay outbox
(`OUTBOX_RELAY_INTERVAL_MS`, mặc định 5000ms) cộng worker domain-event; webhook cần thêm hai chặng.

Đẩy pipeline trực tiếp thay vì ngủ: gọi `outboxService.relayOutboxEvents`, hoặc
`POST /api/v1/management/outbox/relay`.

### 10.6 Chỗ đã biết là dễ flaky

| Chỗ                                                           | Vì sao                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| `meters.integration.test.ts` — `setTimeout` thật              | ép `receivedAt` khác nhau; lệch đồng hồ DB/process là đỏ  |
| `meters.integration.test.ts` — assert event 40 ngày "quá cũ"  | dính chặt vào `METER_DEDUP_WINDOW_DAYS`                   |
| `outbox.integration.test.ts` — vòng poll `waitForPublished`   | fail ra dạng timeout 30s, không phải assert rõ ràng       |
| `ledger.integration.test.ts` — 1000 giao dịch, concurrency 25 | lý do chính của `testTimeout: 30_000`; máy tải nặng là đỏ |

### 10.7 Lỗ hổng coverage

| Vùng                          | Hiện trạng                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Route HTTP**                | **0 test.** Không có `fastify.inject()` ở đâu. ~40 route, schema TypeBox, status code, hình dạng lỗi                                    |
| **Auth**                      | **0 test.** Bốn hook `verify*Request` + `api-key.plugin.ts`. Chính rule của repo nói auth phải test từng nhánh                          |
| **Idempotency plugin**        | service có test, **plugin thì không** — nhánh replay chưa bao giờ chạy qua HTTP                                                         |
| **Webhook**                   | `webhook.service.ts` không có file test. Không retry/backoff, không endpoint CRUD, không nhánh giao thất bại                            |
| **Worker**                    | `apps/worker` 0 test                                                                                                                    |
| **Outbox**                    | đúng 1 test. Không claim/lease expiry, không retry, không thứ tự                                                                        |
| **Meter ingestion**           | đúng 1 test, dù là hot path — các giới hạn khác của tầng này ở [technique 07](technique/07-metering.md)                                 |
| **Logic thuần trong service** | `assertTransition`, `assertPricesUsable`, `resolveInterval`, `resolveTrialEnd`, `assertPriceShape`, `resolveReplay` — chưa có unit test |
| **Repository**                | không test trực tiếp. `cursor.ts` là logic thuần, chưa có unit test                                                                     |
| **UI**                        | erp-ui và billing-portal-ui không có test runner, 0 test                                                                                |

Ngoài `src/utils/`, **mọi service chỉ được test qua database thật**.

Xếp theo giá trị nếu phải chọn chỗ bỏ công: bốn auth hook và hình dạng lỗi (qua `fastify.inject`),
nhánh replay của idempotency plugin, hợp đồng `externalId` ở [mục 3](#3-sổ-cái-và-hợp-đồng-ngầm-externalid),
`payInvoice` chạy song song, và dunning quẹt thẻ hai lần khi retry.

### 10.8 Helper đang bị chép lặp

Chỉ `tests/context.ts` là dùng chung. Những thứ sau lặp gần như nguyên văn và đủ ba lần để xứng đáng
trích ra thành factory (theo [testing.md](../.claude/rules/agentkit/core/testing.md)):

- `makeOpenInvoice` — `payments.integration.test.ts` và `dunning.integration.test.ts`
- tạo customer kèm test clock — `rating.`, `meters.`
- dựng subscription — `invoices.`, `reporting.`, `subscriptions.`
- đọc ngược bằng raw SQL — `invoices.`, `dunning.`, `payments.`

### 10.9 Hai chi tiết dễ mất công

- Integration test **bắt buộc** đúng hậu tố `.integration.test.ts`. Đặt sai thì không fail — nó
  **không bao giờ chạy**.
- `vitest.config.ts` (unit) chưa bật `clearMocks`. Hiện vô hại vì chưa có `vi.mock` / `vi.spyOn` nào,
  nhưng sẽ cắn ngay khi bắt đầu viết unit test cho service.

Bộ fixture hiện có để dựng kịch bản: PSP giả lập kích lỗi bằng `paymentMethod` (`pm_card_ok`,
`pm_card_declined`, `pm_card_insufficient_funds`, `pm_card_error`), còn dunning đọc từ
`customer.metadata.defaultPaymentMethod`.

## Đọc tiếp

- [flows/00 — Bản đồ toàn hệ thống](flows/00-index.md)
- [ROADMAP.md](ROADMAP.md) — những gì còn chặn đường ra production
- [RESEARCH.md](RESEARCH.md) §8 rủi ro kiến trúc — bối cảnh domain của phần lớn mục ở trên
