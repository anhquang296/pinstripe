# 0030 — ERP modular monolith: `platform` và các module, mỗi module một Postgres schema

- **Trạng thái.** Accepted — đang triển khai theo từng bước (Phase 1b xong).
- **Dựa trên.** [0029 — Đổi tên dự án thành vxrerp](0029-rename-to-vxrerp.md).

## Bối cảnh

Repo là ERP nội bộ thay HubSpot, billing là module đầu tiên, CRM là module thứ hai. Toàn bộ domain
đang nằm trong một package `@vxrerp/core` và một Postgres schema `public`, nên không có gì ngăn một
module đọc thẳng bảng của module khác, và không nhìn vào DB mà biết bảng nào thuộc ai.

Một team nhỏ làm mọi module, nên ranh giới nằm **trong code**, không nằm ở deploy: vẫn một API, một
worker, một DB.

## Quyết định

### 1. Hai lớp: `platform` và module

`@vxrerp/platform` giữ thứ mọi module dùng chung: config, database client, lỗi, IAM (better-auth,
users, api keys), audit log, outbox, event log, webhook, idempotency, queue, redis, file storage,
SMTP. `@vxrerp/billing` giữ domain billing. Module phụ thuộc platform; **platform không bao giờ import
module**.

### 2. Danh mục dùng chung là shared kernel trong platform

Permission, domain event type, aggregate type, tiền tố GID, tên queue / workflow, namespace Redis và
loại hosted resource là các tập đóng mà platform cần để làm việc — API key mang permission, webhook
lọc theo event type, outbox ghi event type. Chúng ở lại platform dưới dạng enum liệt kê giá trị của
mọi module (`PermissionEnum`, `DomainEventTypeEnum`, `ObjectPrefixEnum`…). Đó là chuỗi, không phải
import code module.

Đánh đổi có chủ ý: thêm một module thì thêm giá trị vào các catalog này. Đổi lại, enum vẫn đóng (theo
`enum-convention.md`), `openapi.json` và type của SDK không bị nới thành `string`, và không cần một
cơ chế đăng ký runtime.

### 3. Mỗi lớp một Postgres schema

Bảng của platform nằm trong schema `platform`, bảng billing trong `billing`, khai bằng
`platformPgSchema.table(...)` / `billingPgSchema.table(...)` (`DatabaseSchemaEnum`). Drizzle luôn
sinh tên bảng kèm schema, nên query qua drizzle không cần `search_path`. SQL viết tay (test, script
seed, docs) **phải** ghi rõ schema (`billing.invoices`) — không có `search_path` mặc định để dựa vào.

Không có FK từ platform sang module. FK từ module sang platform được phép; sang module khác thì không.

### 4. Mỗi package tự giữ migration, re-baseline

Không có FK xuyên schema theo chiều nào, nên mỗi package giữ một luồng migration độc lập trong thư
mục `migrations/` của chính nó. `drizzle.config.ts` của package có `schemaFilter` về schema của mình
và bảng theo dõi riêng: `drizzle.__platform_migrations`, `drizzle.__billing_migrations`. Package export
migration source của nó (`platformMigrationSource`, `billingMigrationSource`), resolve thư mục qua
`<package>/package.json` chứ không qua đường dẫn tương đối. Platform luôn chạy trước.

Thứ biết đủ các module là composition root, không phải platform: `apps/api/scripts/migrate-database.ts`
và `reset-database.ts` chạy `migrateDatabase(url, [platform, billing])`; `pnpm db:migrate` /
`pnpm db:reset` gọi chúng.

37 migration cũ bị xoá và thay bằng:

- `packages/platform/migrations/0000_baseline.sql` — 11 bảng của platform.
- `packages/modules/billing/migrations/0000_baseline.sql` — 49 bảng của billing.
- `packages/modules/billing/migrations/0001_triggers_view_seed.sql` — viết tay: ba function và mười
  hai trigger bất biến (ledger, invoice, credit note, refund, meter event), view
  `ledger_account_balances`, seed `number_sequences`.

Đây là ngoại lệ có chủ ý của `migration-convention.md` §"Historical migrations are immutable": dự án
chưa lên production, không DB nào ngoài local từng chạy chuỗi cũ. Tính tương đương được kiểm bằng dump:
DB migrate bằng chuỗi cũ và DB migrate bằng hai luồng mới, sau khi quy tên schema về một, cho ra đúng
371 statement giống nhau (bảng, cột, constraint, index, FK, function, trigger, view).

Từ baseline trở đi, luật migration bất biến áp dụng lại bình thường.

### 5. Config, lịch chạy và decorator tách theo lớp

- `envSchema` / `fastify.config` chỉ còn key hạ tầng. Key của billing (PSP, Vexere, dunning, billing
  run, portal TTL, hosted URL…) nằm ở `billingEnvSchema`, đọc qua `fastify.billingConfig`.
- `fastify.workflowSchedules` giữ lịch của outbox, webhook và API rate limit; lịch của billing ở
  `fastify.billingSchedules`.
- `HostedUrlFactory` thuộc billing: nó sinh URL cho checkout, payment link và invoice.
- Mỗi package có một `fastify.augmentation.ts` và một cặp registry; app đăng ký `platformPlugin` rồi
  `billingPlugin`. `bootstrap-admin` chỉ cần `platformPlugin`.
- `DatabaseClient` không gắn với schema nào (không dùng relational query), nên platform không cần biết
  bảng của module.
- Identity của portal (`portal_users`, `portal_memberships`, `portal_sessions`) **ở lại billing** vì
  membership có FK tới `customers`; nó chuyển sang platform khi membership trỏ tới `companyId` của CRM.

### 6. Module đăng ký handler domain event vào platform

`DomainEventDispatchService` của platform nhận mọi job `DomainEventDispatch`: fan-out webhook như
trước, rồi chạy các handler module đã đăng ký bằng `registerDomainEventHandler({ name,
aggregateTypes, handle })`. Billing đăng ký `billing.entitlement-sync` cho aggregate `subscription`
trong `billingDomainEventPlugin`. Processor của worker chỉ còn một dòng và không biết module nào; tên
handler trùng là `ConflictError` lúc khởi động.

Plan ban đầu nói tới một `ModuleDefinition` gom route, permission, event và schema. Chỉ phần event
cần cơ chế đăng ký — permission, event type và prefix là shared kernel (mục 2), còn route / schema /
migration đã được app liệt kê tường minh. Manifest đầy đủ để lại tới khi module thứ hai cho thấy nó
có ích.

### 7. erp-ui chia theo feature, `features/auth` ghép

Một app nội bộ duy nhất (`apps/erp-ui`), bên trong chỉ có `features/<feature>/`.
`features/billing` giữ mọi màn billing, `features/admin` giữ bề mặt của platform (user, role,
settings). Mỗi feature export một `FeatureDefinition` gồm `routes`, `navigationItems` và
`reportRangePaths`; `features/auth` — nơi có đăng nhập, `RequireSession`, layout, sidebar, topbar — ghép chúng — route của mỗi feature thành con của `RequireSession` →
`FeatureLayout` của chính nó, mục menu thành nhóm theo `NavigationGroupEnum`. `features/auth` là feature duy nhất được import feature khác; feature còn lại không import `auth` hay nhau, `common/` không import feature nào; `apps/erp-ui/eslint.config.js` chặn cả ba chiều. URL của mọi
màn không đổi.

URL của mọi feature trừ `auth` mang prefix bằng tên feature (`/billing/customers`, `/admin/users`,
`/admin/settings/account`).

UI có hai tầng, theo kiểu app launcher của Odoo. Sau đăng nhập, `/` là màn chọn ứng dụng: mỗi feature
là một ô (`title`, `icon`, `tone` trong `FeatureDefinition`), chỉ hiện khi người dùng thấy được ít nhất
một mục menu của nó. Chọn một ô là vào tầng feature: mỗi feature có `FeatureLayout` riêng, sidebar chỉ
chứa menu của chính nó — không còn một sidebar gộp mọi module, thứ sẽ phình ra theo số module.
`features/admin` hiện là ứng dụng "Cài đặt" (tài khoản, người dùng, vai trò), với lối
tắt ở top bar. Webhook và API key là màn của module (`/billing/webhooks`, `/billing/api-keys`): người
dùng tạo chúng cho một mục đích, và cắm hay rút một module không được chạm vào webhook, key của module
khác — module sau này cần webhook thì có màn riêng dưới prefix của nó. Hạ tầng phía server (bảng,
service, outbox → webhook) vẫn ở platform, nhưng mỗi endpoint và mỗi key mang cột `module`:
endpoint chỉ đăng ký event của module mình (`DOMAIN_EVENT_MODULES`), key chỉ mang permission của
module mình (`PERMISSION_MODULES`), list lọc theo `module`, và fan-out chỉ quét endpoint của module
phát event. Key `module = null` là key của cả ERP, chỉ sinh từ env `SECRET_API_KEY`; cài đặt riêng của một module nằm trong nhóm "Cài đặt" của chính module đó (ví dụ
`/crm/settings`). Prefix khai một lần trong `routes/paths.ts`,
page dựng URL bằng hằng path và `generatePath`, không viết chuỗi.

### 8. Ranh giới được lint

`packages/platform/eslint.config.js` cấm import `@vxrerp/billing*` qua tuỳ chọn `importBans` của preset
`node`. Hạ tầng test dùng chung (`loadTestEnv`, `createTestDatabaseSetup`, `truncateDatabase`) nằm ở
`@vxrerp/platform/testing`; test integration của platform chạy chỉ với platform, không nạp billing.

## Hệ quả

- DB local cũ không migrate tiếp được: `pnpm db:reset` rồi seed lại. Test tự dọn `public`, `platform`,
  `billing`, `drizzle` trong global setup.
- Phase 1b xong. Phase 2 bắt đầu bằng khung module CRM (`@vxrerp/crm`, schema `crm`, `features/crm` ở
  `/crm`, permission `crm.read`) chưa có tính năng: nó chứng minh một module cắm vào đủ mọi điểm nối và
  nhận event `customer.*` của billing qua `crm.customer-activity` mà không import billing. Checklist thêm
  module nằm trong `erp-module-convention.md`.
- `buildMigrationSource` nhận `import.meta.url` của module gọi nó: resolve từ vị trí của platform chỉ
  chạy khi pnpm tình cờ link được package đó, và hỏng ngay với module thứ hai.
