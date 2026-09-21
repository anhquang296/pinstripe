# Development

## Yêu cầu

Node 22+, pnpm 10+, Docker.

## Khởi động

```bash
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm dev
```

| Service             | Cổng  | Ghi chú                                                            |
| ------------------- | ----- | ------------------------------------------------------------------ |
| api                 | 3000  | `/healthz`, `/v1/*`, `/api/v1/{admin,system,management}/*`         |
| worker outbox       | 3001  | relay outbox → domain event queue                                  |
| worker domain-event | 3002  | consume domain event                                               |
| worker ledger       | 3003  | quét sổ lệch mỗi 60s                                               |
| worker billing      | 3004  | shard + jitter, tạo hóa đơn nháp cho kỳ đến hạn                    |
| worker webhook      | 3005  | giao webhook, retry backoff, tối đa 5 lần                          |
| worker dunning      | 3006  | thu lại theo lịch `DUNNING_RETRY_DELAY_DAYS`                       |
| worker notification | 3007  | gửi email; nhắc nợ chuyển khoản mỗi `INVOICE_REMINDER_INTERVAL_MS` |
| erp-ui              | 5173  | Vite, proxy `/api` và `/v1` sang api; xác thực bằng cookie session |
| portal-ui           | 3100  | Next.js + BFF; cần `VXRERP_API_URL` + `VXRERP_PORTAL_API_KEY`      |
| postgres            | 55432 | user/pass/db: `vxrerp`                                             |
| redis               | 56379 |                                                                    |
| mailpit             | 58025 | UI xem email dev                                                   |

## Đăng nhập dashboard

`apps/erp-ui` đi bằng cookie session của better-auth, không bằng API key: Vite chỉ proxy `/api` và
`/v1` sang API, không chèn header nào, nên một bản build ra khỏi `vite dev` xác thực đúng như khi dev.

Biến môi trường của đường đăng nhập, đọc trong `better-auth.plugin.ts`:

| Biến                               | Ghi chú                                        |
| ---------------------------------- | ---------------------------------------------- |
| `BETTER_AUTH_SECRET`               | tối thiểu 32 ký tự, ký cookie session          |
| `ADMIN_UI_ORIGIN`                  | origin được phép POST vào `/api/v1/auth/*`     |
| `ADMIN_SESSION_IDLE_TTL_MINUTES`   | hết hạn khi không dùng                         |
| `ADMIN_SESSION_ABSOLUTE_TTL_HOURS` | hết hạn tuyệt đối tính từ lúc tạo session      |
| `GOOGLE_OAUTH_CLIENT_ID`           | Google chỉ bật khi có đủ cả ba biến `GOOGLE_*` |
| `GOOGLE_OAUTH_CLIENT_SECRET`       |                                                |
| `GOOGLE_OAUTH_ALLOWED_DOMAIN`      | domain duy nhất được đăng nhập bằng Google     |

Sign-up không tồn tại ở server. Admin đầu tiên được tạo bằng route management, idempotent:

```bash
curl -X POST http://localhost:3000/api/v1/management/users/bootstrap \
  -H "Authorization: Bearer $MANAGEMENT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@vxrerp.test","name":"Admin","password":"<tối thiểu 12 ký tự>"}'
```

Người dùng tiếp theo tạo trong dashboard ở `/admin/users`. Không có đường xoá user: hạ quyền hay vô
hiệu hoá đi qua cập nhật, để `UserService` còn giữ được luật admin active cuối cùng.

## Lệnh hay dùng

```bash
pnpm test
```

```bash
pnpm --filter @vxrerp/billing test:integration
```

```bash
pnpm db:generate
```

## Port bị giữ sau khi `pnpm dev` chết không sạch

`turbo dev` không phải lúc nào cũng giết hết cây process con khi Ctrl-C, nên một lần chạy có thể để lại
`next-server`, `vite` hoặc worker vẫn giữ port. Lần `pnpm dev` sau báo `EADDRINUSE :::3100` — port bị
chính lần chạy trước của dự án giữ, không phải app nào khác.

```bash
pnpm dev:stop
```

Giết mọi process đang LISTEN trên `3000`–`3006`, `3100`, `5173`, kèm các process `node` và `pnpm` cha
của chúng (nếu không, `tsx watch` sẽ dựng lại). Dừng leo lên khi gặp shell, nên terminal và các session
khác không bị ảnh hưởng.

- Không bao giờ đụng Docker: port do container publish sẽ hiện ra dưới tên `com.docker.backend`, giết
  nó là sập Docker Desktop. Container thì dùng `pnpm docker:down`.
- Giết **mọi** dev process của repo này, kể cả cái mà một terminal khác đang dùng.

## Xoá sạch dữ liệu để test lại từ đầu

```bash
pnpm db:reset
```

Drop schema `public` và `drizzle`, tạo lại schema rồi chạy lại toàn bộ migration, sau đó xoá mọi key
Redis dưới prefix `REDIS_KEY_PREFIX` (queue BullMQ, idempotency, meter-dedup, entitlement, billing-run
lock). Không dùng `DELETE`/`TRUNCATE` được vì ledger, meter event, invoice và payment bị trigger
append-only chặn.

- Dừng `pnpm dev` trước khi chạy — worker đang chạy sẽ ghi dữ liệu mới vào giữa lúc reset.
- Không đụng tới file migration trên đĩa, cũng không đụng volume Docker và Mailpit.
- Từ chối chạy khi `NODE_ENV=production`.

Muốn sạch cả volume Docker (Postgres data, Redis AOF, Mailpit):

```bash
docker compose -f docker/compose.yml down -v && pnpm docker:up && pnpm db:migrate
```

## API hiện có

| Resource          | Endpoint                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Customers         | `POST/GET /v1/customers`, `GET/POST/DELETE /v1/customers/:customerId`                                                                   |
| Products          | `POST/GET /v1/products`, `GET/POST /v1/products/:productId`                                                                             |
| Prices            | `POST/GET /v1/prices`, `GET/POST /v1/prices/:priceId`                                                                                   |
| Subscriptions     | `POST/GET /v1/subscriptions`, `GET/POST/DELETE /v1/subscriptions/:subscriptionId`                                                       |
| Entitlements      | `GET /v1/entitlements`                                                                                                                  |
| Meters            | `POST/GET /v1/billing/meters`, `GET/POST /v1/billing/meters/:meterId`, `GET /v1/billing/meters/:meterId/event_summaries`                |
| Meter events      | `POST /v1/billing/meter_events`, `POST /v1/billing/meter_event_batches`                                                                 |
| Rating            | `GET /v1/invoices/upcoming?subscriptionId=…`                                                                                            |
| Invoices          | `POST/GET /v1/invoices`, `GET /v1/invoices/:invoiceId`, `POST /v1/invoices/:invoiceId/{finalize,pay,void}`                              |
| Credit notes      | `POST/GET /v1/credit_notes`, `GET /v1/credit_notes/:creditNoteId`                                                                       |
| Coupons           | `POST/GET /v1/coupons`, `GET/POST/DELETE /v1/coupons/:couponId`                                                                         |
| Promotion codes   | `POST/GET /v1/promotion_codes`, `GET/POST /v1/promotion_codes/:promotionCodeId`                                                         |
| Discounts         | `POST/GET /v1/discounts`, `GET/POST/DELETE /v1/discounts/:discountId`                                                                   |
| Tax rates         | `POST/GET /v1/tax_rates`, `GET/POST /v1/tax_rates/:taxRateId`                                                                           |
| Tax ids           | `POST/GET /v1/tax_ids`, `GET/DELETE /v1/tax_ids/:taxIdId`                                                                               |
| Payments          | `POST/GET /v1/payment_intents`, `GET /v1/payment_intents/:id`, `POST /v1/payment_intents/:id/{confirm,cancel}`                          |
| Refunds           | `POST/GET /v1/refunds`, `GET /v1/refunds/:refundId`                                                                                     |
| Webhooks          | `POST/GET /v1/webhook_endpoints`, `GET/POST /v1/webhook_endpoints/:id`, `GET /v1/webhook_deliveries`                                    |
| Reporting (admin) | `GET /api/v1/admin/reporting/revenue`, `GET /api/v1/admin/reporting/reconciliation`                                                     |
| Test clocks       | `POST/GET /v1/test_helpers/test_clocks`, `POST /v1/test_helpers/test_clocks/:id/advance`                                                |
| Ledger (admin)    | `GET /api/v1/admin/ledger/accounts`, `GET/POST /api/v1/admin/ledger/transactions`, `POST /api/v1/admin/ledger/transactions/:id/reverse` |

Mọi `POST` nhận header `Idempotency-Key`. List dùng cursor `after` / `before`.

## Route không yêu cầu auth

| Route                                   | Lý do                                              |
| --------------------------------------- | -------------------------------------------------- |
| `GET /healthz` (api, cổng 3000)         | health check của load balancer, không chạm dữ liệu |
| `GET /healthz` (worker, 3001/3002/3003) | như trên; trả 503 khi worker đang drain            |

Mọi route khác đều gắn hook xác thực ở cấp submodule (`verifyApiRequest`, `verifyAdminRequest`,
`verifySystemRequest`, `verifyManagementRequest`). Route public nằm riêng trong
`apps/api/src/routes/public/` để tên submodule tự nói lên điều đó.

## Lint

```bash
pnpm lint
```

ESLint encode phần rule agentkit mà máy bắt được (brace style, logging `{ error }`, local đặt tên
theo bước, lodash, import alias, ranh giới Drizzle). Phần còn lại vẫn dựa vào rule + review — xem
`docs/adr/0006-rule-compliance.md`.

## Gọi thử API

```bash
curl -s -H "Authorization: Bearer $SECRET_API_KEY" localhost:3000/v1/ping
```

## Lưu ý

- `packages/platform` và `packages/modules/*` được build (`exports` trỏ `dist`). Sửa chúng xong phải rebuild — `pnpm dev` và
  `turbo` tự lo thứ tự, nhưng chạy một package lẻ thì không.
- Migration là journal: không xoá file đã generate, luôn tạo migration mới.
