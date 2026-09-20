# 0028 — Một cây route dưới `/v1`, permission thay cho scope

- **Trạng thái.** Accepted
- **Thay thế.** [0024 — Đăng nhập dashboard và authorization theo session](0024-dashboard-auth-and-session-authorization.md)
  §"Session mở được `/api/v1/admin/*` và `/v1/*`" và §"Permission theo route, fail closed".
- **Sửa một phần.** [0001 — Nền tảng Phase 0](0001-phase-0-foundation.md) §6 (bốn env API key),
  [0026 — Cổng nhà xe](0026-customer-portal-auth-and-bff.md) (đường dẫn upstream của BFF).

## Bối cảnh

Bộ route cũ có sáu prefix: `/v1`, `/portal`, `/hosted`, `/api/v1/auth`, `/api/v1/admin`,
`/api/v1/system`, `/api/v1/management`. `route-convention.md` nói nhóm route theo **caller**, nhưng
ba prefix cuối thật ra nhóm theo **credential**: chúng tồn tại vì mỗi nhóm dùng một API key khác, chứ
không vì chúng phục vụ một người gọi khác.

Bốn hệ quả đo được:

- **Resource sản phẩm nằm ngoài API sản phẩm.** `ledger`, `reporting`, `users`, `api_keys`,
  `account` là dữ liệu thật của sản phẩm nhưng ở dưới `/api/v1/admin`, nên không khai `operationId`,
  không có tag, và không có mặt trong `openapi.json`. Bề mặt công khai mô tả 129 operation trong khi
  sản phẩm có 145.
- **SDK phải có hai transport.** `_adminTransport` tồn tại chỉ để mang một key khác tới cùng một
  server, và kéo theo `adminApiKey`, `isAdminConfigured`, `PINSTRIPE_ADMIN_API_KEY`, `AdminNamespace`.
- **API key không đi qua authorization.** `authorizeRequest` chỉ kiểm `request.actor`. Một request
  mang Bearer được `authenticateRequest` kiểm scope rồi cho qua thẳng — nghĩa là một key scope `admin`
  làm được **mọi thứ** trên bề mặt admin, còn một session admin thì bị kiểm từng permission. Bất đối
  xứng này không phải chi tiết cài đặt; nó là lỗ hổng phân quyền của bề mặt máy gọi máy.
- **Scope không trả lời được câu hỏi cần trả lời.** `ApiKeyScopeEnum` nói key được gọi _prefix nào_,
  không nói được _làm được gì_. Stripe làm ngược lại: restricted key mang permission theo resource.

## Quyết định

### 1. Năm surface, tất cả dưới `/v1`

```
/healthz                      liveness, không version
/v1/**                        Product API      — API key hoặc dashboard session, authorizeRequest
/v1/portal/**                 Cổng nhà xe      — portal key (2 route) + portal session
/v1/hosted/**                 Trang hosted     — signed token querystring
/v1/auth/**                   Đăng nhập        — better-auth, allowlist 9 path
/v1/webhooks/psp/:provider    PSP callback vào — HMAC signature
```

Mỗi surface đúng một credential — đó là thứ `route-convention.md` thật sự đòi. Bốn surface không
phải product API là plugin đóng gói riêng đăng ký cạnh `v1Routes` trong `routes.ts`, **không** lồng
bên trong nó, nên `verifyApiRequest` của product API không chạm tới chúng và chúng vẫn nằm ngoài
`openapi.json` (không gọi `tagRouteByPrefix`).

`admin`, `system`, `management` biến mất. `ledger`, `reporting`, `users`, `api_keys`, `account` vào
`/v1` và khai `operationId` như mọi resource v1 khác. `POST /api/v1/management/users/bootstrap`
thành CLI `pnpm --filter @pinstripe/api bootstrap-admin`; `POST /api/v1/management/outbox/relay` bị
bỏ vì `apps/worker` đã chạy `outboxService.relayOutboxEvents` qua workflow.

`/v1/portal` và `/v1/billing_portal` là hai thứ khác nhau và cùng tồn tại: `portal` là cổng của
khách hàng nhà xe (ADR 0026), `billing_portal` là resource clone của Stripe. Giữ cả hai tên vì cả BFF
lẫn `sdk-convention.md` đã nói `portal`.

### 2. API key mang permission, không mang scope

`api_keys.scopes: ApiKeyScope[]` → `api_keys.permissions: Permission[]`, dùng đúng `PermissionEnum`
mà session đang dùng. `ApiKeyScopeEnum` bị xoá. Thêm một member: `PORTAL_WRITE = 'portal.write'` cho
hai route `POST /v1/portal/links` và `POST /v1/portal/sessions`.

| `ApiKeyTypeEnum` | permissions               |
| ---------------- | ------------------------- |
| `SECRET`         | toàn bộ `PermissionEnum`  |
| `RESTRICTED`     | đúng tập được cấp lúc tạo |
| `PUBLISHABLE`    | `[portal.write]`          |

`ROLE_PERMISSIONS[ADMIN]` chuyển từ `Object.values(PermissionEnum)` sang hằng `ADMIN_PERMISSIONS`
liệt kê tường minh 14 permission của dashboard. Lý do: `portal.write` là quyền của máy gọi máy, và
`Object.values` sẽ âm thầm cấp nó — cùng mọi permission phi-dashboard thêm về sau — cho role admin.

Env còn `SECRET_API_KEY` và `PORTAL_API_KEY`. `ADMIN_API_KEY`, `SYSTEM_API_KEY`,
`MANAGEMENT_API_KEY`, `PINSTRIPE_ADMIN_API_KEY` bị xoá.

### 3. `authorizeRequest` chạy cho cả API key lẫn session

`authenticateRequest` bỏ tham số `scope`: Bearer → `request.auth`, cookie `pinstripe.*` →
`request.actor`, không có cả hai → 401. `authorizeRequest` lấy `permissions` từ `actor` hoặc `auth`,
resolve permission của route, không khớp → 403; không resolve được → 403 (fail closed, giữ nguyên).

Ràng buộc "cookie không xác thực được surface máy gọi máy" của ADR 0024 vẫn đúng, nhưng nay là hệ quả
cấu trúc chứ không phải một danh sách: `verifyPortalKeyRequest` gọi thẳng `authenticateApiKey`, còn
hosted / webhooks / auth có hook riêng không đụng tới cookie.

### 4. `resolveOperationPermission` tra override trước, shortcut read sau

Thứ tự cũ cho `find*` / `get*` → `billing.read` **trước** khi tra `OPERATION_PERMISSIONS`. Khi `users`
và `api_keys` vào `/v1`, thứ tự đó biến `GET /v1/users` thành quyền đọc của role `member`. Nay tra
override theo full `operationId` trước, rồi mới tới shortcut read, rồi mới tới key theo resource;
`users.find`, `users.get`, `apiKeys.find` có entry riêng.

## Hệ quả

- SDK còn một transport. `pinstripe.users`, `pinstripe.apiKeys`, `pinstripe.account`,
  `pinstripe.reporting` lên top level; `pinstripe.ledger.accounts` / `.transactions` thành
  `LedgerNamespace`, cùng hình dạng với `BillingNamespace`. Tên hook và query key **không đổi**.
- `openapi.json` đi từ 129 lên 145 operation, và `route-permission.test.ts` — vốn duyệt mọi
  `operationId` trong spec — nay phủ luôn ledger / reporting / users / api_keys / account.
- BFF của `portal-ui` proxy tới `${PINSTRIPE_API_URL}/v1/portal/...`, và route handler chuyển sang
  `app/bff/v1/portal/[...path]`. Allowlist `PORTAL_ROUTES` không đổi.
- `basePath` của better-auth là `/v1/auth`; `auth-client.ts` của admin-ui và proxy của
  `vite.config.ts` đổi theo (proxy nay chỉ còn `/v1`).
- Migration `0034` drop `api_keys.scopes`, `0035` add `api_keys.permissions`. Key đã tồn tại mất
  quyền sau migration, nên `ensureBootstrapApiKeys` chuyển từ create-if-absent sang upsert
  permissions theo token hash — mỗi lần boot tự vá lại key bootstrap của chính môi trường đó.

## Đã biết, chưa sửa

Hook xác thực là `preHandler`, mà Fastify chạy validation **trước** `preHandler`. Một request sai
schema vì thế nhận 400 trước khi bị hỏi giấy tờ, kể cả khi không mang credential nào. Hành vi này có
từ trước ADR này và không đổi ở đây; sửa nó là chuyển hook sang `onRequest`, và cái giá là mất
`request.body` đã parse trong hook.
