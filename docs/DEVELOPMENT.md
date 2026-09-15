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

| Service             | Cổng  | Ghi chú                                                    |
| ------------------- | ----- | ---------------------------------------------------------- |
| api                 | 3000  | `/healthz`, `/v1/*`, `/api/v1/{admin,system,management}/*` |
| worker outbox       | 3001  | relay outbox → domain event queue                          |
| worker domain-event | 3002  | consume domain event                                       |
| worker ledger       | 3003  | quét sổ lệch mỗi 60s                                       |
| admin-ui            | 5173  | Vite, proxy `/api` sang api kèm admin key                  |
| portal-ui           | 3100  | Next.js                                                    |
| postgres            | 55432 | user/pass/db: `pinstripe`                                  |
| redis               | 56379 |                                                            |
| mailpit             | 58025 | UI xem email dev                                           |

## Lệnh hay dùng

```bash
pnpm test
```

```bash
pnpm --filter @pinstripe/core test:integration
```

```bash
pnpm db:generate
```

## API hiện có

| Resource       | Endpoint                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Customers      | `POST/GET /v1/customers`, `GET/POST/DELETE /v1/customers/:customerId`                                                                   |
| Products       | `POST/GET /v1/products`, `GET/POST /v1/products/:productId`                                                                             |
| Prices         | `POST/GET /v1/prices`, `GET/POST /v1/prices/:priceId`                                                                                   |
| Subscriptions  | `POST/GET /v1/subscriptions`, `GET/POST/DELETE /v1/subscriptions/:subscriptionId`                                                       |
| Entitlements   | `GET /v1/entitlements`                                                                                                                  |
| Meters         | `POST/GET /v1/billing/meters`, `GET/POST /v1/billing/meters/:meterId`, `GET /v1/billing/meters/:meterId/event_summaries`                |
| Meter events   | `POST /v1/billing/meter_events`, `POST /v1/billing/meter_event_batches`                                                                 |
| Rating         | `GET /v1/invoices/upcoming?subscriptionId=…`                                                                                            |
| Test clocks    | `POST/GET /v1/test_helpers/test_clocks`, `POST /v1/test_helpers/test_clocks/:id/advance`                                                |
| Ledger (admin) | `GET /api/v1/admin/ledger/accounts`, `GET/POST /api/v1/admin/ledger/transactions`, `POST /api/v1/admin/ledger/transactions/:id/reverse` |

Mọi `POST` nhận header `Idempotency-Key`. List dùng cursor `startingAfter` / `endingBefore`.

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

- `packages/core` được build (`exports` trỏ `dist`). Sửa core xong phải rebuild — `pnpm dev` và
  `turbo` tự lo thứ tự, nhưng chạy một package lẻ thì không.
- Migration là journal: không xoá file đã generate, luôn tạo migration mới.
