# ERP Module Convention

Repo là một modular monolith: `@vxrerp/platform` cộng các module (`@vxrerp/billing`, sau này CRM). Ranh giới chỉ nằm trong code — cùng một API, một worker, một DB — nên không có gì ngoài quy ước này và lint ngăn một module đọc thẳng bảng của module khác, hay platform bắt đầu biết về billing. Không ghi lại thì ranh giới mòn đi từng import một, và việc tách module sau này thành không thể. Xem ADR 0030.

## Scope

Applies to `packages/platform/**`, `packages/modules/**`, và tới composition root của `apps/api` / `apps/worker`.

Does **not** apply to:

- `packages/sdk` và hai frontend — chúng theo [`sdk-convention.md`](./sdk-convention.md), [`erp-ui-convention.md`](./erp-ui-convention.md).
- Migration đã sinh ra — chúng theo `drizzle/migration-convention.md`.

## Hướng phụ thuộc

Module phụ thuộc platform. Platform **không bao giờ** import module, và một module không import module khác. `packages/platform/eslint.config.js` chặn chiều platform → module qua `importBans` của preset `node`; module mới thêm dòng của mình vào đó.

```ts
// CORRECT — packages/modules/billing/src/services/invoice.service.ts
import { NotFoundError } from '@vxrerp/platform/errors';

// WRONG — packages/platform/src/services/webhook.service.ts
import { InvoiceService } from '@vxrerp/billing/services';
```

Platform cần phản ứng với việc của module thì module đăng ký handler vào platform (domain event qua `domainEventDispatchService.registerDomainEventHandler` trong plugin của module, lọc theo `aggregateTypes`), không phải platform gọi sang module.

## Code thuộc lớp nào

Một file thuộc platform khi mọi module đều cần nó và nó không biết một khái niệm nghiệp vụ nào của module: config hạ tầng, database client, lỗi, IAM, audit, outbox, event log, webhook, idempotency, queue, redis, file storage, SMTP. Mọi thứ còn lại thuộc module.

| Loại       | Platform                                            | Module                                                              |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| Env        | `envSchema` → `fastify.config`                      | `<module>EnvSchema` → `fastify.<module>Config`                      |
| Lịch chạy  | `fastify.workflowSchedules`                         | `fastify.<module>Schedules`                                         |
| Decorator  | `platform/src/plugins/fastify.augmentation.ts`      | augmentation riêng của module                                       |
| Registry   | `repositoryRegistryPlugin`, `serviceRegistryPlugin` | `<module>RepositoryRegistryPlugin`, `<module>ServiceRegistryPlugin` |
| Plugin gốc | `platformPlugin`                                    | `<module>Plugin`, đăng ký **sau** `platformPlugin`                  |

Một helper chỉ sinh URL / chuỗi cho entity của module (như `HostedUrlFactory`) thuộc module dù cơ chế bên trong trông chung chung.

## Danh mục dùng chung là shared kernel

`PermissionEnum`, `ROLE_PERMISSIONS`, `DomainEventTypeEnum`, `AggregateTypeEnum`, `ObjectPrefixEnum`, `QueueNameEnum`, `WorkflowNameEnum`, `RedisNamespaceEnum`, `DatabaseSchemaEnum` nằm ở platform và liệt kê giá trị của **mọi** module. Thêm module thì thêm member vào các enum này — đó là chuỗi, không phải import code. Đừng tách chúng thành `string` + đăng ký runtime: `openapi.json` và type của SDK sẽ mất enum đóng.

## Mỗi module một Postgres schema, một luồng migration

- Bảng khai bằng `<module>PgSchema.table(...)`; platform dùng `platformPgSchema`. Không `pgTable` trần.
- Không có FK từ platform sang module, và không có FK giữa hai module. Tham chiếu sang module khác là cột id thuần, giữ nhất quán bằng domain event.
- Mỗi package có `migrations/` riêng: `drizzle.config.ts` với `schemaFilter: ['<schema>']` và `migrations.table: '__<schema>_migrations'`, export `<module>MigrationSource` qua `buildMigrationSource`. Platform chạy trước.
- Chỉ composition root biết đủ các module: `apps/api/scripts/migrate-database.ts` / `reset-database.ts` và `tests/global-setup.ts` liệt kê migration source theo thứ tự.

SQL viết tay — test, script seed, docs — **luôn** ghi rõ schema. Không có `search_path` để dựa vào.

```ts
// CORRECT
sql`update billing.invoices set due_at = now() where id = ${invoiceId}`;

// WRONG — trỏ vào public, nơi không có bảng nào
sql`update invoices set due_at = now() where id = ${invoiceId}`;
```

## Test

Hạ tầng test dùng chung ở `@vxrerp/platform/testing`: `loadTestEnv(overrides)`, `createTestDatabaseSetup(sources)`, `truncateDatabase`. Test của platform chỉ đăng ký `platformPlugin` và chỉ migrate platform — nếu nó cần billing thì test đó thuộc billing. Seed đặc thù module (như `number_sequences`) được dựng lại trong `tests/context.ts` của module, không trong platform.

## Thêm một module

`@vxrerp/crm` là mẫu tối thiểu: một module chưa có tính năng nhưng đã cắm đủ mọi điểm nối. Module mới đi đúng các bước này; bước nào thiếu thì module chưa được cắm.

| Lớp           | Việc                                                                                                                                                                           | Chỗ (theo mẫu CRM)                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Shared kernel | Thêm member vào `DatabaseSchemaEnum`, và permission của module vào `PermissionEnum` + `ROLE_PERMISSIONS`                                                                       | `packages/platform/src/types/database-schema.ts`, `contracts/users.types.ts` |
| Package       | `packages/modules/<m>` (`@vxrerp/<m>`): `package.json` export `./database`, `./plugins` (điều kiện `import` **và** `default`), tsconfig, tsup, eslint                          | `packages/modules/crm/`                                                      |
| Dữ liệu       | `<m>PgSchema`, `drizzle.config.ts` với `schemaFilter` + `__<m>_migrations`, `pnpm db:generate`, `<m>MigrationSource` gọi `buildMigrationSource(import.meta.url, …)`            | `src/database/`                                                              |
| Plugin        | `<m>Plugin` đăng ký registry, config, và handler domain event của module                                                                                                       | `src/plugins/crm.plugin.ts`                                                  |
| Ranh giới     | Thêm `@vxrerp/<m>*` vào `importBans` của platform và của mọi module khác; module mới cấm lại các module đã có                                                                  | `eslint.config.js` từng package                                              |
| Composition   | Đăng ký `<m>Plugin` sau `billingPlugin`; thêm migration source vào `migrate-database.ts`, `reset-database.ts`, `apps/api/tests/global-setup.ts`; thêm dependency               | `apps/api`, `apps/worker`                                                    |
| UI            | `features/<m>` với `FeatureDefinition`, thêm vào `ERP_FEATURES`, thêm tên vào danh sách feature của `eslint.config.js`; `title` / `icon` / `tone` cho ô trên màn chọn ứng dụng | `apps/erp-ui/src/features/crm/`                                              |

Thứ tự đăng ký plugin là thứ tự phụ thuộc: `platformPlugin` → các module. Module không phụ thuộc nhau nên thứ tự giữa chúng không quan trọng, trừ thứ tự chạy handler cho cùng một event.

## NEVER Do

- Import một module từ platform, hay import module này từ module kia.
- Để platform gọi service của module thay vì để module đăng ký handler vào platform.
- Đặt key env, lịch chạy hay decorator của module vào `envSchema` / `workflowSchedules` / augmentation của platform.
- Khai bảng bằng `pgTable` trần, hay tạo FK từ platform sang module hoặc giữa hai module.
- Gộp migration của hai package vào một journal, hay cho platform liệt kê migration source của module.
- Viết SQL tay mà không ghi schema.
- Nới một enum của shared kernel thành `string` để module tự đăng ký giá trị.
- Để test của platform nạp `billingPlugin`, hay đưa seed của module vào `truncateDatabase`.
- Gọi `buildMigrationSource` mà không truyền `import.meta.url` của chính module — platform không resolve được package mà nó không phụ thuộc.
