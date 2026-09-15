# Kiến trúc hệ thống subscription billing tự xây (in-house): Thiết kế tầng kiến trúc trước khi vào schema

## TL;DR
- Hãy bắt đầu bằng một **modular monolith** trên NestJS/PostgreSQL/BullMQ với các bounded context tách bạch bằng ranh giới code (mỗi module chỉ lộ một API rõ ràng, không đọc bảng của module khác), coi **Ledger append-only double-entry** và **Metering ingestion** là hai thành phần cần tách sớm nhất; **mua/tích hợp** PSP (VNPay/MoMo/ZaloPay), tax và e-invoice thay vì tự xây.
- Ba trụ cột kiến trúc bắt buộc cho tính đúng đắn (correctness): **transactional outbox** cho mọi sự kiện, **idempotency key + dedup store** cho mọi thao tác tạo tiền, và **sổ cái bất biến (immutable ledger)** mà số dư là projection — đây là điều các đội Uber, Airbnb, Stripe, Modern Treasury đều hội tụ về sau khi tự xây thất bại lần đầu.
- Rủi ro kiến trúc lớn nhất không phải throughput mà là **billing run tại thời điểm cuối tháng (thundering herd), proration mid-cycle, dedup usage event, và bất biến của hồ sơ tài chính** — de-risk bằng sharding + jitter cho scheduler, event sourcing cho ledger và usage, và pháp lý hóa đơn (không được sửa/xóa hóa đơn đã phát hành, chỉ dùng credit note).

---

## Key Findings

1. **Phân rã bounded context là chuẩn hóa được.** Kill Bill (nền tảng billing mã nguồn mở) chia hệ thống thành các core service xếp chồng: **catalog → entitlement → invoice → payment → overdue**, giao tiếp một chiều từ trên xuống bằng API và giao tiếp ngược bằng **persistent bus** (sự kiện bền vững). Lago tách rõ **high-throughput event ingestion** khỏi **transactional billing logic** và **background processing**. Đây là bộ khung để bạn ánh xạ các thành phần của mình.

2. **Rating ≠ Charging ≠ Billing ≠ Invoicing.** Metering biến raw event thành metric tổng hợp; **rating** áp giá lên metric để ra số tiền; **invoicing** gom line item thành hóa đơn có vòng đời draft→finalize→issue; **payment** thu tiền. Tách các trách nhiệm này là quyết định kiến trúc cốt lõi.

3. **Entitlement view phải tách khỏi billing view.** Kill Bill diễn đạt bằng công thức "Subscription = Entitlement + Billing Information": người dùng có thể được cấp quyền dùng dịch vụ trước khi bị tính tiền, hoặc bị hủy quyền dùng ngay nhưng vẫn tiếp tục bị bill tới hết kỳ (End-Of-Term) để tránh phải hoàn tiền proration. Pleo cũng rút ra đúng bài học này khi tự xây.

4. **Sổ cái kép bất biến là thành phần kiến trúc, không phải bảng phụ.** Uber (nền tảng Gulfstream, SOX-compliant, double-entry, immutable audit trail qua UAC), Airbnb (chuyển từ pipeline MySQL trigger sang hệ event-based double-entry), Stripe, Modern Treasury ("build the ledger first") và các ledger mã nguồn mở (TigerBeetle, Formance, Blnk) đều nhấn: **postings là append-only, số dư là projection, sửa sai bằng bút toán đảo (reversal) chứ không update/delete.**

5. **Outbox + idempotency + dedup là bắt buộc.** Ghi DB và publish event không atomic → dùng transactional outbox. Stripe lưu kết quả theo `Idempotency-Key`, retry với backoff + jitter để tránh thundering herd. Metering cần dedup theo `transaction_id`/composite key trong một cửa sổ thời gian — ví dụ m3ter: "sending a measurement is an idempotent operation within a 35 day window — each measurement is stored for 35 days based on their receivedAt timestamp", dedup theo event UUID + composite key (account + meter + timestamp).

6. **Scheduler của billing run là điểm nghẽn thật.** Cuối tháng hàng loạt subscription cùng đến hạn → thundering herd. Cách xử lý: sharding key-space, jitter theo cron mở rộng (kiểu "H" của Jenkins / Google SRE), và cân nhắc workflow engine (Temporal) cho các quy trình nhiều bước dài hạn thay vì chỉ queue worker (BullMQ).

7. **Bối cảnh Việt Nam:** hóa đơn điện tử (e-invoice) là **bắt buộc** toàn quốc từ 1/7/2022 theo Nghị định 123/2020/NĐ-CP; NĐ này được sửa đổi/bổ sung bởi **Nghị định 70/2025/NĐ-CP** (Chính phủ ban hành 20/03/2025, hiệu lực từ 01/06/2025, sửa 40/61 điều của NĐ 123/2020). Hóa đơn phải có định dạng chuẩn, đánh số tuần tự, nội dung bằng tiếng Việt và số Ả Rập, một số loại cần mã xác thực của cơ quan thuế (GDT) — nên **tích hợp nhà cung cấp e-invoice** thay vì tự xây. Thanh toán nội địa qua VNPay, MoMo, ZaloPay, VietQR (NAPAS).

---

## Details

### 1. Phân rã thành phần / bounded context

Dưới đây là các thành phần chuẩn của một hệ subscription billing, kèm trách nhiệm (owns) và ranh giới.

| Thành phần | Sở hữu (owns) | Ghi chú kiến trúc |
|---|---|---|
| **Product & Pricing Catalog** | Product, price/plan, pricing model (flat, tiered, volume, per-unit, package), **versioning giá** | Kill Bill dùng catalog XML, mỗi version có `effectiveDate` (không có số version), phải giữ version cũ để grandfathering. Ưu tiên **immutable price versions** + effective dating. |
| **Subscription / Contract Management** | Vòng đời, state machine, schedule, trial, upgrade/downgrade, cancel | Là "bộ não" điều phối. Nên là state machine tường minh; giữ tách entitlement khỏi billing. |
| **Rating & Pricing Engine** | Chuyển (usage + config subscription) → số tiền charge | Tách rating (áp giá) khỏi charging/billing. Metronome/Orb lưu **raw event, áp metric lúc read** để cho phép backfill và repricing lịch sử. |
| **Metering / Usage Ingestion** | Nhận event throughput cao, aggregation, **dedup**, late/out-of-order | Tách "hot path" (enforcement real-time) khỏi "cold path" (tổng hợp để bill). Dedup theo idempotency key; event-time + watermark cho late event. |
| **Entitlements / Feature access** | Khách được phép làm gì; enforce quota real-time | Gọi ở request path; đọc plan + usage counter + credit + trạng thái subscription rồi allow/limit/deny. Đồng bộ từ billing bằng event. |
| **Invoicing** | Sinh hóa đơn, vòng đời draft→finalize→issue, line item, **đánh số tuần tự pháp lý** | Số hóa đơn phải tuần tự, không trùng, không nhảy cóc (yêu cầu compliance). Hóa đơn đã phát hành **bất biến**. |
| **Payments / PSP orchestration** | Trừu tượng hóa gateway, tokenization, retry, 3DS, đa nhà cung cấp | Abstraction layer để cắm nhiều PSP; dùng idempotency với PSP; lưu trạng thái foreign state mutation. |
| **Dunning / Revenue recovery** | Lịch retry, grace period, thông báo | State machine riêng; Kill Bill gọi là "overdue" — cấu hình bằng file, có thể chặn entitlement và/hoặc billing. |
| **Ledger / Accounting** | Double-entry, số dư khách, credit, ghi nhận doanh thu, xuất GL | Append-only, immutable, balances là projection. Tách business object (mutable) khỏi accounting object (source of truth). |
| **Tax calculation** | Tính thuế/VAT theo vùng | Nên **mua/tích hợp**; VN cần e-invoice + VAT. |
| **Notification/communication** | Email/webhook cho khách và nội bộ | Tách worker riêng (Lago có webhook worker riêng ký HMAC/JWT). |
| **Reporting/Analytics** | MRR/ARR, churn, feed sang data warehouse | CQRS: read model riêng cho từng consumer (portal khách, dashboard finance, tra cứu support). |
| **Admin/back-office + Self-service portal** | Vận hành nội bộ + khách tự quản subscription/hóa đơn | Lago cung cấp portal nhúng + live usage dashboard. |

**Cái gì là service thật vs module trong monolith?** Với đội nhỏ, hầu hết nên là **module trong một modular monolith**. Chỉ tách thành service riêng khi có "lý do thật" (chi phí có tên): (a) **Metering ingestion** — throughput và pattern scale khác hẳn phần còn lại, tách sớm; (b) **Ledger** — cần cô lập tính đúng đắn và có thể dùng datastore chuyên biệt; (c) **Notification/webhook** và **PDF** — I/O-bound, cô lập độ trễ. Catalog, Subscription, Invoicing, Rating, Dunning, Entitlement có thể ở chung monolith giai đoạn đầu.

Sai lầm khi tách phổ biến: (1) tách quá sớm khi chưa có tín hiệu tổ chức (nhiều đội giẫm chân nhau, deploy nghẽn); (2) **distributed monolith** — service tách nhưng vẫn chia chung DB, deploy chung; (3) để module này đọc thẳng bảng của module kia — "nếu billing đọc thẳng bảng orders thì hai module đã hàn dính nhau dù code trông sạch". Dùng lint/CI chặn import xuyên ranh giới (ví dụ nothing outside `/billing` imports `/billing/internal`).

### 2. Các mẫu và phong cách kiến trúc cho billing

**Modular monolith vs microservices.** Bắt đầu monolith mô-đun hóa; đường tiến hóa: Simple monolith → Modular monolith → xác định bottleneck → strangler-fig tách service đầu tiên → microservices nơi thực sự cần. "Distributed systems là cách đắt nhất để giải một vấn đề bạn chưa có."

**Event-driven, event sourcing, CQRS.**
- **Event sourcing thực sự đáng giá ở Ledger và Usage:** double-entry ledger *bản chất* là event-sourced (postings = event, balance sheet = projection). Usage cũng vậy: lưu raw event cho phép backfill/repricing (Metronome/Orb).
- **Overkill ở:** Catalog, Subscription CRUD đơn giản. "Nếu lý do chỉ là 'auditability' mơ hồ thì đừng — một history table cho bạn 80% giá trị với gần như không chi phí." CQRS (tách read/write model) hữu ích cho reporting mà không cần event sourcing toàn hệ.

**Transactional outbox.** Vì "commit DB và publish Kafka là hai I/O riêng, tiến trình có thể crash giữa chừng" → ghi event vào bảng outbox trong *cùng* transaction với thay đổi nghiệp vụ, rồi một relay/CDC (Debezium) publish sau. Đây là nền tảng cho tính đúng đắn của billing; consumer phải idempotent vì có thể giao hàng trùng.

**Saga / process manager.** Quy trình billing nhiều bước (invoice → payment → cập nhật entitlement → notify) là saga. Ưu tiên **orchestration** (một orchestrator giữ state, dễ debug, audit trail đầy đủ) hơn choreography thuần. Mỗi bước và mỗi compensation phải idempotent; nếu refund (compensation) thất bại thì saga phải ở trạng thái COMPENSATING (được cảnh báo), không được âm thầm đánh dấu CANCELLED.

**Double-entry ledger như thành phần kiến trúc.** Immutable, append-only, mỗi transfer có source + destination, tổng mọi posting = 0 (zero-sum) → "biến việc giả mạo thành báo động số học". Modern Treasury: "chúng tôi xây ledger trước, mọi thứ khác xây trên nó". TigerBeetle: schema debit/credit dựng sẵn, account flag chặn số dư âm ở tầng DB. Formance: hash-chain, bi-temporal, sequence number không được có khoảng trống.

**Idempotency architecture.** Client sinh key (UUID v4); server lưu status+body của lần đầu theo key, trả lại y nguyên cho retry. Stripe dùng "atomic phases" + recovery point + completer để resume sau crash. Cần dedup store (Redis) với TTL. Mọi side-effect (webhook, ledger entry, notification) phải idempotent hoặc gated sau cùng key.

**Temporal/bitemporal.** Hai trục thời gian: "chuyện xảy ra khi nào" (valid time) vs "hệ thống biết khi nào" (transaction time). Cần cho effective-dating giá, backdated correction mà không viết lại lịch sử. Hồ sơ tài chính bất biến: sửa = append bút toán mới.

**Scheduling / job orchestration.**
- BullMQ (Redis) đủ cho phần lớn job; nhưng billing run cuối tháng dễ thundering herd.
- Chống thundering herd: **sharding key-space + jitter theo thời gian** ("shard là lát thời gian thay vì replica"), enqueue theo tick nhỏ thay vì đổ toàn bộ, dùng dedup để park key. Google SRE mở rộng cú pháp crontab để rải tải.
- **Temporal** cho quy trình dài hạn/nhiều bước (subscription renewal, dunning) — durable execution, audit trail, retry/timeout tích hợp; đánh đổi là vận hành phức tạp và chi phí. Với đội nhỏ: giữ BullMQ, cân nhắc Temporal khi saga trở nên phức tạp.

**Clock & time.** Test clock / simulated time là mối quan tâm kiến trúc: Lago chạy process Clockwork riêng enqueue job định kỳ. Cần trừu tượng hóa "now" để test được các kịch bản proration, trial end, renewal; xử lý timezone (Lago chạy phần lớn job hàng giờ để bao các timezone khách).

### 3. Các luồng dữ liệu/điều khiển chính (mô tả để vẽ sequence diagram)

**(a) Tạo subscription → hóa đơn đầu → thanh toán → cấp entitlement**
```
Client → Subscription: create(plan, customer, payment_method)
Subscription → Catalog: resolve plan+price (theo effectiveDate)
Subscription: tạo subscription (state=PENDING) + outbox event
Rating: tính charge kỳ đầu (in-advance) [+proration nếu cần]
Invoicing: tạo invoice DRAFT → FINALIZE (đánh số tuần tự) → ISSUE
Invoicing → (event) Payment: charge(invoice, method, idempotency_key)
Payment → PSP: authorize/capture (3DS nếu cần)
PSP → Payment: success
Payment → Ledger: postings (Dr Accounts Receivable / Cr Revenue-deferred, Dr Cash...)
Payment → (event) Subscription: activate → Entitlement: grant
Notification: gửi receipt + e-invoice
```

**(b) Billing run định kỳ**
```
Scheduler (jitter/shard) → chọn subscription đến hạn (currentPeriodEnd <= now)
For each shard (worker BullMQ):
  Rating: tổng hợp usage (nếu có) + phí cố định
  Invoicing: DRAFT → refresh → FINALIZE → ISSUE
  Payment: charge (idempotent)
  Nếu fail → Dunning state machine
  Ledger: postings; Notification
```
Lago minh họa lịch: "Bill Customers" chạy hàng giờ (phút :10), "Finalize Invoices" (:20), "Mark Overdue" (:25), "Process Dunning Campaigns" (:45), có job "Retry Failed Invoices" mỗi 15 phút như lớp retry thứ hai.

**(c) Usage event → aggregation → rating → lên hóa đơn**
```
Producer → Ingestion API: event(customer, meter, qty, ts, transaction_id)
Ingestion: validate → dedup (theo transaction_id, cửa sổ thời gian) → enrich
→ ghi vào append-only store (raw events)
Aggregation: sum/count/unique/max theo billing window (event-time + watermark cho late event)
Rating: áp giá tiered/volume lên metric
Invoicing: thêm line item vào invoice kỳ hiện tại
```

**(d) Đổi plan giữa kỳ → proration → invoice/credit**
```
Subscription: change_plan(new_plan, effective=now)
Rating: tính proration = credit phần chưa dùng của plan cũ + charge phần còn lại plan mới
Invoicing: tạo line item proration (credit + charge) hoặc credit note nếu ròng âm
Ledger: postings tương ứng
Entitlement: cập nhật quyền theo plan mới ngay (tách khỏi thời điểm bill)
```

**(e) Thanh toán thất bại → dunning → suspend → cancel/recover**
```
Payment: fail → Dunning: state=RETRY_1
Scheduler: retry theo lịch (backoff) + notify khách
Nếu vẫn fail qua các mốc → GRACE → Entitlement: block_entitlement (chặn quyền dùng)
                                    (có thể vẫn block_billing hoặc tiếp tục bill tới EOT)
Nếu thu được → recover: unblock entitlement, ledger cập nhật
Nếu hết grace → CANCEL subscription
```

**(f) Refund / credit note → bút toán ledger**
```
Admin/logic: refund(invoice, amount, idempotency_key)
KHÔNG sửa/void hóa đơn gốc → tạo CREDIT NOTE (số riêng, tuần tự)
Payment → PSP: refund (idempotent)
Ledger: bút toán đảo (reversal) — không update/delete posting cũ
```

### 4. Non-functional / mối quan tâm kiến trúc trọng yếu

- **Correctness & auditability > performance thô.** Billing "async được nhưng phải kịp thời"; ưu tiên đúng và truy vết được.
- **Biểu diễn tiền:** dùng **integer minor unit** hoặc **DECIMAL/NUMERIC** — không bao giờ float (0.1+0.2 ≠ 0.3). Lưu kèm currency ISO-4217; chú ý JPY/ISK có 0 chữ số thập phân, một số tiền tệ có 3. Làm tròn một lần theo policy có tên. Stripe API nói bằng integer minor unit.
- **Ranh giới nhất quán:** strong consistency trong ledger posting và finalize invoice (transaction DB); eventual consistency cho projection/report/entitlement sync (qua event).
- **Reconciliation 3 chiều:** đối soát order/billing ↔ PSP settlement ↔ bank. "Ngay cả khi PSP idempotent vẫn cần reconciliation — đừng giả định hệ ngoài luôn đúng." Chuẩn hóa dữ liệu mỗi PSP về một ledger nội bộ chuẩn; sai lệch xử lý qua exception workflow + điều chỉnh thủ công có kiểm soát.
- **Idempotent retries** ở mọi tầng tạo tiền.
- **Observability & alerting billing — cần cảnh báo trên:** hóa đơn kẹt ở DRAFT quá lâu; billing run fail/không chạy; ledger mất cân đối (tổng posting ≠ 0); queue latency/backlog (Lago theo dõi `sidekiq_queue_latency_seconds`, độ sâu queue); dedup rate tăng bất thường (retry storm); consumer lag của usage pipeline; tỉ lệ payment decline.
- **DR & replay:** raw event và posting là append-only, không xóa → có thể replay dựng lại state.
- **Compliance:** audit trail đầy đủ (Kill Bill chèn audit + history row trong cùng transaction); đánh số hóa đơn tuần tự; data retention; **giảm phạm vi PCI-DSS bằng tokenization** (không lưu PAN, dùng token của PSP); kiểm soát kiểu SOX (Uber Gulfstream SOX-compliant); GDPR / Nghị định bảo vệ dữ liệu cá nhân VN (PDPL).

### 5. Case study thực tế & bài học

- **Kill Bill (open source, nên nghiên cứu trực tiếp):** kiến trúc xếp chồng catalog→entitlement→invoice→payment→overdue; **persistent bus** đảm bảo giao hàng (có thể trùng → handler phải idempotent), thiết kế cho throughput thấp ("vài event/giây, không phải hàng nghìn"); hai bus (main + external cho plugin) để code plugin chậm không chặn nội bộ; audit/history ghi trong cùng transaction; billing IN_ADVANCE vs IN_ARREAR (usage chỉ IN_ARREAR) qua khái niệm Charged-Through-Date.
- **Lago (open source):** tách ingestion / billing logic / background; nhiều Redis (queue, cache, event store); clock process riêng; dedicated worker cho events/webhook/PDF/payments; không retry job mặc định, dùng dead queue + scheduled retry job làm lớp hai. Về scale: mặc định free/docs của Lago dẫn ~15.000 event/s; con số **1 triệu event/s** đến từ case study "A million events per second: How Lago scales usage-based billing with ClickHouse Cloud" — "By moving to ClickHouse Cloud and using ClickPipes, Lago scaled from 10K events per second to enterprise workloads of 1M events per second" (tức cần setup ClickHouse enterprise, không phải mặc định).
- **Qonto (qua Lago):** trong bài Show HN của các nhà sáng lập Lago (cựu Qonto): "We budgeted 3 months of a single back-end to 'get it done, once and for all'... we changed the billing cycles from anniversary dates to calendar dates which looked trivial until we had to migrate 100K+ companies." Idempotency khi replay event là điểm khó.
- **Scaleway (Kevin Deldycke, cựu VP Engineering):** "What should have been a one-year R&D project ended up taking seven years of my professional life, in which I grew the billing team from 0 to 12 people. So yes, if you ask me, billing is hard." (Con số "đội billing từ 0 lên 12 người full-time" thuộc về Scaleway/Deldycke, không phải Qonto.)
- **Pleo (Arnon Shimoni):** "billing khó xây, khó thiết kế, và khó chạy nếu bạn lệch khỏi 'chuẩn' dù chỉ một chút"; bài học: tiền không phải luôn 2 chữ số thập phân; **không được hủy/void hóa đơn đã tạo, phải dùng credit note**; phải tách billing engine khỏi entitlement engine.
- **Uber (Gulfstream):** double-entry, SOX-compliant, immutable audit trail (UAC); mô hình "Money Order" và thiết kế LOB-agnostic; hot-key/thundering herd khi một số account vượt 3–4 update/giây → xây "User Account Batch Processing" (batching ~250ms + Redis coordination + optimistic atomic updates) đạt "over 30 update operations per second per user account", "cutting multi-hour pipelines down to minutes". Về ledger: migrate ">a trillion entries (making up a few petabytes of data)" từ DynamoDB sang **LedgerStore** ("verifiably immutable" bằng chữ ký mật mã; Gulfstream ra mắt 2017 trên DynamoDB).
- **Airbnb:** hệ cũ dùng MySQL trigger để cưỡng ép immutability ("không phải pattern hay, nhưng cần thiết lúc đó"), logic tài chính dính chặt logic reservation, nightly run >24h; bài học: **tách financial logic khỏi product logic**, chuyển sang event-based double-entry, xử lý alteration bằng "unbook + rebook".
- **Stripe:** idempotency key trên mọi endpoint mutating; thundering herd fix bằng backoff + jitter; kết quả chỉ lưu sau khi endpoint bắt đầu chạy.
- **Modern Treasury / Formance:** "build the ledger first"; tách business object (mutable) khỏi accounting object (source of truth); "balance amnesia" — lưu con số hiện tại mà không giải thích được nó sinh ra thế nào (ví dụ phí bị net khỏi settlement mà không ghi posting riêng → lệch $2 không ai giải thích được).

### 6. Kiến trúc tham chiếu đề xuất cho tình huống của bạn

**C4 Level 1 (Context) — mô tả text để vẽ Mermaid:**
```
[Khách hàng] → (Self-service Portal / App) → [Billing Platform]
[Nhân viên] → (Admin/Back-office) → [Billing Platform]
[Billing Platform] → [PSP: VNPay/MoMo/ZaloPay/VietQR] (charge/refund)
[Billing Platform] → [E-invoice provider] (phát hành hóa đơn điện tử, mã xác thực GDT)
[Billing Platform] → [Tax engine] (VAT)
[Billing Platform] → [Email/Notification]
[Billing Platform] → [Data Warehouse] (MRR/ARR/churn)
[Product/App khác của công ty] → (usage events) → [Billing Platform]
```

**C4 Level 2 (Containers) — modular monolith + vài service tách:**
```
NestJS Modular Monolith (ECS Fargate) gồm module:
  - Catalog (immutable price versions, effective dating)
  - Subscription (state machine, schedules)
  - Rating (proration, tiered/volume)
  - Invoicing (draft→finalize→issue, đánh số tuần tự)
  - Payment Orchestration (abstraction đa PSP, idempotency)
  - Dunning (state machine)
  - Entitlement (enforce quota, cache Redis)
  - Outbox (bảng outbox + relay worker)
Tách sớm:
  - Metering Ingestion Service (API throughput cao + dedup + aggregation) — có thể dùng Elasticsearch cho query usage
  - Ledger Service (append-only double-entry; PostgreSQL riêng, hoặc TigerBeetle khi cần)
Hạ tầng:
  - PostgreSQL (RDS) — nguồn sự thật giao dịch
  - Redis (ElastiCache) — dedup store, cache entitlement, BullMQ
  - BullMQ workers — billing run (shard+jitter), dunning, notification, PDF, webhook
  - CDK để IaC; ECS Fargate để chạy API + worker tách nhóm
```

**Điểm khởi đầu:** một deployable (monolith) + tách riêng **Metering** và **Ledger** ngay từ đầu vì đặc tính scale/correctness khác biệt. Worker BullMQ tách nhóm theo loại job (billing, events, webhook, pdf, payments) giống mô hình dedicated worker của Lago.

**Đường tiến hóa:** khi khối lượng tăng → bật thêm dedicated worker → tách Invoicing/PDF, Notification/Webhook thành service → cân nhắc Temporal cho saga billing/dunning → đa vùng khi cần data residency.

**Mua thay vì xây (đặc biệt cho VN):**
- **PSP:** tích hợp VNPay, MoMo, ZaloPay, VietQR (NAPAS); lưu ý thẻ quốc tế Visa/Mastercard qua cổng như OnePay. Recurring/thẻ lưu: dùng tokenization của cổng để giảm phạm vi PCI-DSS.
- **E-invoice (hóa đơn điện tử):** bắt buộc theo NĐ 123/2020 (sửa bởi NĐ 70/2025); hóa đơn có/không có mã xác thực của cơ quan thuế; nội dung phải bằng tiếng Việt, số Ả Rập, đủ trường bắt buộc; đăng ký qua cổng GDT hoặc nhà cung cấp. → **Tích hợp nhà cung cấp e-invoice** (không tự xây phần pháp lý).
- **Tax engine:** tích hợp cho VAT.

**5–8 quyết định kiến trúc rủi ro cao & cách de-risk:**
1. **Billing run cuối tháng (thundering herd)** → shard key-space + jitter + enqueue theo tick nhỏ + idempotent job.
2. **Bất biến & đánh số hóa đơn** → invoice đã issue read-only; sửa bằng credit note số riêng tuần tự; test đảm bảo không nhảy số.
3. **Dedup usage & late event** → idempotency key trên event + cửa sổ dedup + event-time watermark + append-only raw store.
4. **Tính đúng của ledger** → double-entry zero-sum, balances là projection, reversal thay vì update; alert khi tổng posting ≠ 0.
5. **Outbox vs dual-write** → luôn outbox + relay/CDC; consumer idempotent.
6. **Proration mid-cycle** → engine rating thuần (pure function), test property-based, tách entitlement khỏi thời điểm bill.
7. **Reconciliation với PSP/bank** → ledger nội bộ chuẩn + đối soát 3 chiều + exception workflow.
8. **Ranh giới module bị rò rỉ** → lint/CI chặn import xuyên ranh giới, mỗi module một API công khai.

**Anti-patterns cần tránh:**
- Dùng **float** cho tiền.
- **Update/delete** posting hoặc void hóa đơn đã phát hành (thay vì reversal/credit note).
- **Dual write** DB + message broker không qua outbox.
- **Aggregating counter** thay vì lưu raw event (mất khả năng backfill/repricing — "balance amnesia").
- Nhét **pricing/entitlement logic hardcode** trong controller.
- Tách **microservices quá sớm** → distributed monolith.
- Cho module đọc thẳng bảng của module khác.
- Handler event/PSP **không idempotent**.
- Coi **reconciliation** là tùy chọn.

---

## Recommendations

**Giai đoạn 0 (nền tảng, làm ngay):**
1. Chốt biểu diễn tiền (integer minor unit hoặc DECIMAL + currency) và money value object; cấm float trong schema/API/tính toán.
2. Dựng **Ledger append-only double-entry** làm thành phần độc lập ngay từ đầu; balances là projection; alert ledger imbalance.
3. Thiết lập **transactional outbox** + relay, và **idempotency key + Redis dedup store** cho mọi thao tác tạo tiền.
4. Modular monolith NestJS với ranh giới module cưỡng chế bằng lint/CI; mỗi module một API công khai.

**Giai đoạn 1 (MVP billing):**
5. Catalog (immutable price version + effective dating), Subscription state machine, Rating (proration), Invoicing (draft→finalize→issue, đánh số tuần tự), Payment orchestration (1 PSP VN đầu tiên, ví dụ VNPay), Dunning state machine.
6. Tách **Metering Ingestion** thành service với dedup + aggregation nếu có usage-based.
7. Tích hợp **e-invoice provider** và **tax** ngay từ MVP vì là nghĩa vụ pháp lý.
8. Billing run bằng BullMQ với **shard + jitter**; clock abstraction để test proration/trial/renewal.

**Giai đoạn 2 (scale & vận hành):**
9. Bật dedicated worker (events/webhook/pdf/payments); CQRS read model cho MRR/ARR/churn feed sang warehouse.
10. Reconciliation 3 chiều tự động với PSP/bank + exception workflow.
11. Cân nhắc **Temporal** khi saga billing/dunning phức tạp; cân nhắc **TigerBeetle** cho ledger khi throughput/độ tin cậy ledger vượt PostgreSQL.

**Ngưỡng để đổi quyết định (benchmarks):**
- Tách một module thành service khi: có tín hiệu tổ chức (đội giẫm chân nhau, deploy nghẽn) HOẶC pattern scale lệch hẳn (metering/ingestion), KHÔNG tách vì "cho hiện đại".
- Chuyển BullMQ→Temporal khi: saga vượt ~vài bước có compensation phức tạp và cần audit trail/replay tường minh.
- Chuyển PostgreSQL ledger→TigerBeetle khi: gặp contention hot-account, cần >hàng chục update/giây/account, hoặc yêu cầu immutability/độ tin cậy vượt khả năng vận hành SQL.

---

## Caveats
- Nhiều nguồn hay nhất là **blog kỹ thuật của vendor** (Lago, Modern Treasury, Formance, m3ter, Orb) — nguyên tắc (immutability, double-entry, outbox, dedup) là vững và được nhiều bên độc lập xác nhận, nhưng các con số như "1M event/s" (cần ClickHouse enterprise, mặc định ~15K/s), "$X volume" mang tính marketing, nên kiểm chứng trước khi dựa vào.
- Nguồn chất lượng cao nhất (first-party engineering): Uber, Airbnb, Stripe, Kill Bill docs, Google SRE. Bài Airbnb (2017) mô tả hệ đã tiến hóa từ lâu.
- Không tìm được write-up ledger first-party có tác giả tên tuổi từ Monzo/Wise/Revolut trong phạm vi nghiên cứu này; Uber Gulfstream + Modern Treasury là nguồn thay thế mạnh nhất cho mô hình ledger ngân hàng.
- Chi tiết pháp lý VN thay đổi nhanh: NĐ 70/2025/NĐ-CP ban hành 20/03/2025, hiệu lực 01/06/2025, sửa 40/61 điều của NĐ 123/2020; e-invoice bắt buộc toàn quốc từ 01/07/2022. Cần luật sư/nhà cung cấp e-invoice xác nhận trước khi triển khai sản xuất.
- Báo cáo dừng ở tầng kiến trúc theo yêu cầu; schema chi tiết bảng-by-bảng là bước sau.