# Roadmap V3 — Phase 25 → 32: Dashboard

[`ROADMAP-V2.md`](ROADMAP-V2.md) dựng xong bề mặt billing + payments. Thứ đứng giữa bề mặt đó và người
vận hành vẫn là một `admin-ui` ngây thơ: điều hướng bằng một `<select>`, 13 trang phẳng, không đăng nhập,
và nó gọi được API **chỉ vì** Vite dev proxy chèn `PINSTRIPE_ADMIN_API_KEY` / `PINSTRIPE_SECRET_API_KEY`
vào mọi request — một bản build ra khỏi `vite dev` không xác thực được gì cả. Một nửa số hook trong
`@pinstripe/sdk/react` không trang nào dùng, và nhiều resource của SDK chưa có hook.

V3 dựng lại dashboard theo information architecture và ngôn ngữ thị giác của mockup
`vxr-erp-platform` (repo anh em, `../vxr-erp-platform`), trên **HeroUI v3**, với đăng nhập thật bằng
**better-auth + `@better-auth-ui/heroui`**, API được gate bằng session + role, và **toàn bộ** bề mặt
admin-facing của SDK được nối vào UI.

## Quyết định khung cho V3 (đã chốt)

| Vấn đề               | Chốt                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI kit               | **HeroUI v3** (`@heroui/react` + `@heroui/styles`, Tailwind v4). Bỏ `components/ui/*` tự viết.                                                                        |
| Auth UI              | **`@better-auth-ui/heroui`**. `better-auth/react` được import ở **đúng một file**: `apps/admin-ui/src/lib/auth-client.ts`, và chỉ cho path auth.                      |
| Quản trị user        | Đi qua `UserService` + SDK `admin.users`. **Không** dùng plugin `admin` của better-auth-ui / `adminClient` — nó vòng qua luật admin cuối cùng và audit.               |
| Authorization API    | Session cookie → `ROLE_PERMISSIONS` gate cả `/api/v1/admin/*` và `/v1/*`. API key giữ nguyên cho machine caller.                                                      |
| Phạm vi màn          | Chỉ domain pinstripe. Bỏ OTA invoices, OTA reconciliation, Quotes, Roadmap, Tools, Help, customer portal của mockup (`portal.*` thuộc `portal-ui`).                   |
| Ngôn ngữ / định dạng | Copy tiếng Việt, thuật ngữ domain giữ tiếng Anh khi mockup giữ. Tiền: `Intl.NumberFormat('vi-VN', { style: 'currency', currency })` từ minor unit. Ngày `dd/MM/yyyy`. |
| Tạo / sửa            | **Luôn trong drawer** bên phải, như mockup. Không có trang form riêng. Detail drawer mở qua nested route để deep-link được.                                           |

Các rule local bị ảnh hưởng — `auth-convention.md` và `sdk-convention.md` — được **sửa trong chính phase
làm thay đổi**, không để cuối. Rule đang cấm `better-auth/react` trong admin-ui; phase 25 là nơi nới nó.

## Tiến độ

| Phase | Nội dung                                                                     | Công sức | Nhóm     | Trạng thái |
| ----- | ---------------------------------------------------------------------------- | -------- | -------- | ---------- |
| 25    | Route auth dashboard `/api/v1/auth/*`                                        | M        | Backend  | Xong       |
| 26    | Session authorization cho `/api/v1/admin/*` và `/v1/*`                       | L        | Backend  | Xong       |
| 27    | Quản trị user: route admin + SDK `admin.users` / `admin.account` / `apiKeys` | M        | Backend  | Xong       |
| 28    | SDK: hook cho mọi resource admin-facing còn thiếu                            | L        | SDK      | Xong       |
| 29    | admin-ui nền: HeroUI, theme mockup, shell, better-auth-ui, guard             | XL       | Frontend | Chưa       |
| 30    | Màn Sales                                                                    | XL       | Frontend | Chưa       |
| 31    | Màn Finance + Tổng quan                                                      | L        | Frontend | Chưa       |
| 32    | Màn Developers + Admin, dọn code cũ, chốt rule và docs                       | L        | Frontend | Chưa       |

## Đường ngắn nhất

> **25 → 26 → 29** là đủ để dashboard có đăng nhập thật và build ra khỏi `vite dev` vẫn chạy.

27 và 28 là điều kiện của 30–32, không phải của login.

---

## Sự thật nền (đọc trước mọi phase)

Agent chạy đêm **không có** `WebFetch` / `WebSearch`. Mọi thứ cần từ docs bên ngoài nằm ở đây; phần
còn lại đọc từ `node_modules/<pkg>/dist/**/*.d.ts` sau khi `pnpm add`.

### Hiện trạng backend

- `packages/core/src/clients/better-auth.client.ts` — better-auth **1.7.5**. `emailAndPassword` bật,
  `disableSignUp: true`, `minPasswordLength: 12`. Google chỉ bật khi đủ ba biến `GOOGLE_OAUTH_*`
  (`hd: allowedDomain`, `disableImplicitSignUp`). Plugin `admin()` với access control riêng. Session
  `expiresIn` = idle TTL, `updateAge` 300s. `advanced.cookiePrefix: 'pinstripe'`, id qua `generateGid`.
  Method public: `handler(Request)`, `getSession(headers)`, `revokeSession`, `revokeUserSessions`,
  `createUser`, `updateUser`, `setUserPassword`.
- `packages/core/src/plugins/better-auth.plugin.ts` — `basePath = '/api/v1/auth'`,
  `baseURL = ADMIN_UI_ORIGIN`, `trustedOrigins = [ADMIN_UI_ORIGIN]`; decorate `fastify.betterAuth`.
- **Route `/api/v1/auth/*` chưa tồn tại.** Không chỗ nào mount `betterAuth.handler`.
- `ADMIN_SESSION_ABSOLUTE_TTL_HOURS` có trong `packages/core/src/config/env.schema.ts` nhưng **chưa ai đọc**.
- RBAC của repo: `packages/core/src/contracts/users.types.ts` — `UserRoleEnum` (admin/moderator/member),
  `PermissionEnum` (14 quyền), `ROLE_PERMISSIONS`. `UserService`: `findUsers`, `getUser`, `getAccount`
  (→ `AccountResponse = { user, permissions }`), `createUser`, `ensureUser`, `updateUser` (luật admin
  active cuối cùng, revoke session khi đổi role / status / password). Schema `createUserSchema`,
  `updateUserSchema`, `userParamsSchema` đã có.
- **Chưa có** route `/api/v1/admin/users`, **chưa có** đường tạo admin đầu tiên (không ai gọi `ensureUser`).
- `apps/api/src/hooks/authenticate-request.ts` chỉ nhận `Authorization: Bearer <api key>`, gán
  `request.auth: RequestAuth` (khai ở `apps/api/src/plugins/api-key.plugin.ts`).
  `rate-limit.plugin.ts` key theo `request.auth`.
- Route admin hiện có (`apps/api/src/routes/admin/admin.routes.ts`): `api_keys` (POST, GET, DELETE
  `/:apiKeyId`), `ledger`, `reporting`, `/ping`. Mọi route v1 đã khai `schema.operationId` dạng
  `<resource>.<method>`.

### Hiện trạng SDK và admin-ui

- `PinstripeTransport` bỏ header `authorization` khi không có key
  (`packages/sdk/src/client/pinstripe-transport.ts`) — nên một `new PinstripeClient()` không key trên
  trình duyệt sẽ đi bằng cookie same-origin mà không cần sửa transport.
- `apps/admin-ui/vite.config.ts` proxy `/api` và `/v1` sang `http://localhost:3000` và **chèn key**.
- `apps/admin-ui/src/lib/pinstripe.tsx` — `PinstripeProvider` nối `onMutationError` /
  `onMutationSuccess` vào sonner (`src/lib/toast.ts`). Giữ sonner: nó đã là toast entry point duy nhất.
- `src/forms/*-form.ts` (9 file) đã đúng form-convention — tái dùng, mở rộng; đừng viết lại.

### better-auth-ui / HeroUI

Package (không phải `@daveyplate/better-auth-ui` — cái đó là bản shadcn cũ):

| Package                                           | Phiên bản                          |
| ------------------------------------------------- | ---------------------------------- |
| `@better-auth-ui/heroui`, `@better-auth-ui/react` | 1.7.26                             |
| `@heroui/react`, `@heroui/styles`                 | ≥ 3.2.1                            |
| `better-auth` (admin-ui)                          | 1.7.5 — **bằng đúng bản của core** |

Peer phải có: `react-aria`, `react-aria-components`, `@react-aria/utils`, `@react-aria/ssr`,
`@gravity-ui/icons`, `bowser`, `@tanstack/react-form` (≥1.33.5 <2), `@tanstack/react-pacer`,
`@tanstack/react-store`, `@tanstack/react-table` (≥9.2.4 <10), `@internationalized/date`,
`tailwind-merge` **^3** (admin-ui đang ^2.6 — phải nâng), `react-email` ≥ 6. `@better-auth/passkey` và
`@better-auth/api-key` không dùng — không cài nếu peer cho phép bỏ.

CSS: `@import "tailwindcss"; @import "@heroui/styles"; @import "@better-auth-ui/heroui/styles";`

`<AuthProvider>` nhận: `authClient`, `navigate({ to, replace })`, `Link`, `queryClient`, `redirectTo`,
`basePaths` (`/auth`, `/settings`), `viewPaths`, `emailAndPassword`, `socialProviders`, `localization`,
`locale`. Guard: `useAuthenticate` / `ensureSession`. Component: `Auth`, `SignIn`, `SignOut`,
`UserButton`, `UserAvatar`, `UserProfile`, `ChangePassword`, `LinkedAccounts`, `ActiveSessions`.

Client: `createAuthClient` từ `better-auth/react`, **phải** override `basePath: '/api/v1/auth'` (mặc
định là `/api/auth`). Không `plugins: [adminClient()]`.

Endpoint từng component gọi:

| Component                                                          | Endpoint                                                                                  | V3 cho phép?                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------- |
| mọi thứ (guard, UserButton, card)                                  | GET `/get-session` → `{ user, session } \| null`                                          | Có — **giữ nguyên shape**          |
| `SignIn`                                                           | POST `/sign-in/email`, POST `/sign-in/social`                                             | Có                                 |
| `SignOut`                                                          | POST `/sign-out`                                                                          | Có                                 |
| `UserProfile`                                                      | POST `/update-user`                                                                       | Có — body chỉ `name`, `image`      |
| `ChangePassword`                                                   | GET `/list-accounts`, rồi POST `/change-password`                                         | Có                                 |
| nút "đăng xuất thiết bị khác"                                      | POST `/revoke-other-sessions`                                                             | Có                                 |
| `ActiveSessions`                                                   | `/list-sessions`, `/revoke-session(s)`                                                    | **Không** — cần token thô          |
| `SignUp`                                                           | `/sign-up/email`                                                                          | **Không** — server `disableSignUp` |
| `ForgotPassword` / `ResetPassword` / `VerifyEmail` / `ChangeEmail` | `/request-password-reset`, `/reset-password`, `/send-verification-email`, `/change-email` | **Không** — chưa có email sender   |
| plugin admin                                                       | `/admin/*`                                                                                | **Không bao giờ**                  |

Bẫy đã biết:

1. `/get-session` phải trả đúng `{ user, session }` của better-auth. Mọi card đọc `data.user` và
   `data.session.id` trực tiếp. Thay body bằng envelope của repo là gãy toàn bộ UI auth. Chỉ được xoá
   `session.token`.
2. better-auth-ui đọc mã lỗi ở `BetterFetchError.error.code` — tức `code` ở **tầng trên cùng** của body.
   Envelope của repo là `{ error: { type, code, param, message, requestId } }`. Admin-ui cần một
   `customFetchImpl` bóc envelope lỗi thành `{ code, message }`; nếu không, `INVALID_EMAIL_OR_PASSWORD`
   rơi về thông báo chung chung.
3. `SignIn` luôn render link "Sign up" khi `emailAndPassword.enabled`, và `UserButton` có một mục sign up.
   **Không có flag để tắt** trong 1.7.26 (kiểm lại trong `.d.ts` — nếu bản cài có flag thì dùng). Nếu
   không có: override `localization` + CSS để giấu, hoặc tự ghép form sign-in từ các mảnh của
   better-auth-ui. Route `/sign-up/*` phía server vẫn 404 dù UI làm gì.
4. UI mặc định `minPasswordLength: 8`; server đòi 12. Đặt `emailAndPassword.minPasswordLength: 12`.
5. `forgotPassword: false` — không có email sender.
6. Origin check tương thích: fetch same-origin gửi `Origin: http://localhost:5173` trên POST; Vite
   `changeOrigin` chỉ đổi `Host`. Callback Google là GET cross-site — không check Origin trên GET.

### Ngôn ngữ thị giác của mockup

Nguồn: `../vxr-erp-platform/src/web/styles/generated/tokens.css`, `design-system/*.json`,
`src/web/styles/app.css`, `src/web/components/AppShell.tsx`. Chép giá trị dưới đây vào biến CSS của
HeroUI trong `apps/admin-ui/src/index.css`; đừng import file từ repo kia.

| Token                      | Giá trị                                   |
| -------------------------- | ----------------------------------------- |
| primary / hover / active   | `#006AD9` / `#2588E6` / `#0050B3`         |
| primary soft (bg)          | `#E6F6FF`                                 |
| success / soft             | `#00BF1A` / `#E6FFE6`                     |
| warning / soft             | `#FF8200` / `#FFF7E6`                     |
| danger / soft              | `#D9000B` / `#FFE8E6`                     |
| info                       | `#0084FF`                                 |
| layout bg / surface        | `#F2F2F2` / `#FFFFFF`                     |
| border / soft border       | `#D9D9D9` / `#F0F0F0`                     |
| text / label / description | `rgba(0,0,0,.88)` / `.65` / `.45`         |
| radius                     | xs 2, sm 4, **base 6**, lg 8              |
| font                       | "Google Sans", fallback Segoe UI / system |
| control height             | 32px                                      |
| spacing                    | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48       |

Mật độ ERP: body 12–13px; ô bảng 12px, padding 10×12; tiêu đề section 15px/600; giá trị stat 20px bold;
nhãn stat 11px uppercase.

Khung:

- **Sidebar** cố định 248px, nền trắng, viền phải 1px `#F0F0F0`. Dải logo 44px. Mỗi mục cấp một gồm ô
  18px chứa hai chữ cái viết tắt, tiêu đề 13px/500, dòng mô tả 12px xám. Mục active: chữ primary, nền
  primary soft, vạch 2px bên trái. Mục con thụt 36px, có đường kẻ dọc 1px, chữ 12px, chấm 6px.
- **Top bar** 44px, nền trắng, viền dưới: breadcrumb màu primary (`Sales / Subscriptions / Coupons`),
  bên phải là `UserButton`.
- **Page card**: padding trang 12px, một card trắng radius 6. Header: tiêu đề 18/26 bold **màu primary**,
  phụ đề 13px xám, slot action bên phải. Content tabs full-bleed ngay dưới header (14px/500, active màu
  primary với gạch chân 3px). Thân nền `#F2F2F2`, padding 16, khoảng cách khối 24.
- **Công thức một màn**: card "tổng quan" với lưới **4 stat** (nhãn uppercase, số lớn, dòng meta) → card
  "danh sách" với filter bar (đếm "N mục" + select + ô tìm) → bảng compact, cả dòng click được mở drawer
  → phân trang.
- **Ô bảng**: dòng chính đậm + dòng phụ xám monospace (id).
- **Status chip**: xanh lá = active/paid, cam = past_due/review, xanh dương = draft/default, đỏ =
  overdue/void/failed.
- **Drawer** phải, rộng `min(980px, 100vw - 96px)`, overlay đen 26%. Header: tiêu đề 16/600, phụ đề 12px,
  nút đóng. Thân nền xám, form chia section (heading 14/600). Footer phải: Huỷ + nút chính. Nội dung nhiều
  phần dùng **tab trong header drawer**, không dùng stepper.
- Xoá xác nhận bằng dialog, không `window.confirm`.

IA sidebar của V3 (ánh xạ mockup → domain pinstripe):

| Nhóm       | Mục (route)                    | Tab / mục con                                                |
| ---------- | ------------------------------ | ------------------------------------------------------------ |
| Tổng quan  | `/`                            | —                                                            |
| Sales      | Customers `/customers`         | —                                                            |
|            | Products & Prices `/catalog`   | Catalog · Prices                                             |
|            | Subscriptions `/subscriptions` | Subscriptions · Usage-based billing · Coupons & mã KM · Thuế |
|            | Checkout & Portal `/checkout`  | Payment links · Checkout sessions · Portal configurations    |
| Finance    | Invoices `/invoices`           | tab theo trạng thái                                          |
|            | Payments `/payments`           | Payment intents · Refunds                                    |
|            | Ledger `/ledger`               | Accounts · Transactions                                      |
|            | Reports `/reports`             | —                                                            |
| Developers | Webhooks `/webhooks`           | Endpoints · Deliveries                                       |
|            | API keys `/api-keys`           | —                                                            |
|            | Test clocks `/test-clocks`     | —                                                            |
| Admin      | Users `/admin/users`           | —                                                            |
|            | Roles `/admin/roles`           | —                                                            |

Mục mà người dùng không có quyền đọc thì ẩn khỏi sidebar (`useCan`); server vẫn là nơi chặn thật.

---

## Phase 25 — Route auth dashboard

**Mục tiêu.** Mount better-auth ra trình duyệt qua một cửa hẹp, có kiểm soát, để better-auth-ui chạy
được mà không mở `/admin/*` hay `/sign-up/*`.

**Vì sao ở đây.** Mọi thứ khác của V3 đứng trên một session cookie có thật. Route này hiện chỉ tồn tại
dưới dạng chữ trong `auth-convention.md`.

**Deliverables.**

- `apps/api/src/routes/auth/auth.routes.ts`, đăng ký ở `apps/api/src/routes/routes.ts` dưới prefix
  `/api/v1/auth`. Đây là ngoại lệ đã liệt kê của `fastify/route-convention.md` §"Every route declares a
  schema" — ghi lý do cạnh chỗ đăng ký.
- Allowlist, là hằng trong file route: `/sign-in/email`, `/sign-in/social`, `/callback/google`,
  `/sign-out`, `/get-session`, `/change-password`, `/list-accounts`, `/revoke-other-sessions`,
  `/update-user`. Path khác → `NotFoundError`. `/update-user` chỉ nhận key `name`, `image`; key khác →
  `BadRequestError`.
- Mọi POST: `Origin === ADMIN_UI_ORIGIN`, nếu không → `ForbiddenError`. GET không check (callback Google).
- Dựng `Request` từ request Fastify, gọi `fastify.betterAuth.handler`, copy toàn bộ `set-cookie`.
- Body 2xx giữ shape của better-auth, **chỉ** xoá `token` (top-level ở sign-in, `session.token` ở
  `/get-session`).
- Non-2xx → `AppError` subclass (401 `UnauthorizedError`, 403 `ForbiddenError`, 400/422
  `BadRequestError`, 429, còn lại để error handler xử lý), **giữ `code` gốc của better-auth** làm `code`
  của envelope.
- TTL tuyệt đối: một helper (dùng lại ở phase 26) đọc `session.createdAt`; quá
  `ADMIN_SESSION_ABSOLUTE_TTL_HOURS` thì `revokeSession` và coi như không có session. `/get-session`
  trả `null` trong trường hợp đó.
- Tạo admin đầu tiên: `POST /api/v1/management/users/bootstrap` (gắn `verifyManagementRequest` sẵn có),
  gọi `UserService.ensureUser` với role `admin`. Idempotent.
- Sửa `.claude/rules/local/auth-convention.md`: allowlist mới; body là shape của vendor trừ `token`
  (thay cho "thay body bằng `AccountResponse`"); `better-auth/react` được phép **chỉ** ở
  `apps/admin-ui/src/lib/auth-client.ts`; cấm `adminClient` / plugin admin của better-auth-ui; cấm
  mở `/list-sessions` và `/revoke-session`; mã lỗi better-auth được giữ trong envelope.

**Quyết định bị ép phải chốt.** Giấu token nghĩa là bỏ `ActiveSessions`. Chốt: giấu token, bỏ card đó,
thay bằng nút "đăng xuất thiết bị khác" (`/revoke-other-sessions` không cần token).

**Xong khi.** `auth.routes.integration.test.ts` xanh, gồm: path ngoài allowlist và `/admin/list-users`
→ 404; `/sign-up/email` → 404; POST với Origin lạ → 403; sign-in thành công đặt cookie và body không có
`token`; `/get-session` không có `session.token`; sai mật khẩu → 401 với `code` bằng
`INVALID_EMAIL_OR_PASSWORD`; `/update-user` với `role` → 400; session quá TTL tuyệt đối → `/get-session`
trả `null`; bootstrap gọi hai lần vẫn một admin.

**Công sức: M.**

---

## Phase 26 — Session authorization

**Mục tiêu.** Cookie session mở được `/api/v1/admin/*` và `/v1/*`, đúng theo quyền của role — và chỉ
chừng đó.

**Vì sao ở đây.** Có login mà API vẫn chỉ nhận key thì login không bảo vệ gì. Phải xong trước phase 29,
nơi bỏ việc proxy chèn key.

**Deliverables.**

- `apps/api/src/hooks/authenticate-request.ts`:
  - Có `Authorization: Bearer` → đường API key, **không đổi gì**.
  - Không có Bearer nhưng có cookie `pinstripe.*` → `fastify.betterAuth.getSession(request.headers)`;
    không có session / user banned / quá TTL tuyệt đối → `UnauthorizedError`; request không phải GET
    mà `Origin !== ADMIN_UI_ORIGIN` → `ForbiddenError` (CSRF); gán
    `request.actor = { userId, role, permissions }` với `permissions = ROLE_PERMISSIONS[role]`.
    Khai kiểu `actor` cạnh `auth` trong `apps/api/src/plugins/api-key.plugin.ts`.
  - Không có cả hai → `UnauthorizedError` như cũ.
- `verifyApiRequest` / `verifyAdminRequest`: sau khi xác thực, request đi bằng session phải có permission
  route đòi; thiếu → `ForbiddenError`.
- Permission theo route, ở `apps/api/src/constants/permissions.ts`:
  - Route v1: suy từ `request.routeOptions.schema.operationId` (dạng `<resource>.<method>`, resource
    có thể lồng: `billing.meters.getEventSummary`, `testHelpers.testClocks.advance`). Method bắt đầu
    bằng `find` hoặc `get` (`find`, `get`, `getUpcoming`, `getEventSummary`, `findBalanceTransactions`)
    → `billing.read`. Còn lại tra bảng theo `<resource>.<method>` trước, rồi `<resource>`. Ví dụ:
    `customers` → `customer.write`, `customers.delete` → `customer.delete`; `invoices`, `invoiceItems`
    → `invoice.write`, `invoices.void` → `invoice.void`; `creditNotes` → `credit_note.write`;
    `refunds`, `disputes` → `refund.write`; `products`, `prices`, `billing.meters`, `coupons`,
    `promotionCodes`, `discounts`, `taxRates`, `taxIds` → `catalog.write`; `subscriptions`,
    `subscriptionItems`, `checkout.sessions`, `paymentLinks`, `billingPortal.*` →
    `subscription.write`; `billing.meterEvents`, `billing.meterEventBatches` → `subscription.write`;
    `paymentIntents`, `paymentMethods`, `setupIntents`, `payouts` → `refund.write`;
    `webhookEndpoints`, `webhookDeliveries.replay` → `integration.write`; `testHelpers.testClocks` →
    `test_clock.write`. Chốt lại từng dòng khi viết; test bên dưới bắt được dòng thiếu.
  - Route admin: khai `config: { permission }` trên route (ledger ghi → `ledger.write`, `api_keys` →
    `api_key.manage`, reporting → `billing.read`).
  - Không tìm được permission → `ForbiddenError`. **Fail closed.**
- `rate-limit.plugin.ts`: request đi bằng session thì key theo `actor.userId`.
- Vite proxy **vẫn** chèn key trong phase này — UI cũ không được gãy trước phase 29.
- Cập nhật `auth-convention.md`: session gate, CSRF qua Origin, fail closed, API key không đổi.

**Xong khi.** Unit test cho hook (một case một nhánh) và integration test xanh: API key vẫn qua cả hai
surface; session `member` → `GET /v1/customers` 200, `POST /v1/customers` 403; session `moderator` →
`POST /v1/customers` 200, `POST /api/v1/admin/ledger/transactions` 403; không session → 401; user banned →
401; POST bằng session với Origin lạ → 403. Và một test đọc **mọi** `operationId` trong
`apps/api/openapi.json` rồi khẳng định mỗi cái resolve ra một permission.

**Công sức: L.**

---

## Phase 27 — Quản trị user

**Mục tiêu.** Người vận hành quản trị được user và API key qua SDK, đi qua đúng `UserService`.

**Vì sao ở đây.** Màn Admin của mockup (Users & Permissions, Roles) cần nó, và `useCan` ở phase 29 cần
`admin.account.get` để biết quyền của người đang đăng nhập.

**Deliverables.**

- `apps/api/src/routes/admin/users/`: `GET /` (`findUsers`, phân trang như service trả), `GET /:userId`,
  `POST /`, `PATCH /:userId` — `config: { permission: user.manage }`, schema lấy từ `users.types.ts`.
- `apps/api/src/routes/admin/account/`: `GET /` → `UserService.getAccount(request.actor.userId)`.
  Chỉ session; API key → `ForbiddenError`. Không cần permission ngoài việc đã đăng nhập.
- SDK, trong `packages/sdk/src/resources/admin/`: `admin.users` (`find`, `get`, `create`, `update`),
  `admin.account` (`get`), `admin.apiKeys` (`find`, `create`, `delete`). Mỗi resource một `{DOMAIN}_PATH`,
  path param qua `buildPath`. Type qua `src/types/contracts.types.ts` bằng `export type`.
- Hook trong `@pinstripe/sdk/react`: `useUsersQuery`, `useUserQuery`, `useCreateUserMutation`,
  `useUpdateUserMutation`, `useAccountQuery`, `useApiKeysQuery`, `useCreateApiKeyMutation`,
  `useDeleteApiKeyMutation`. Subject mới: `user`, `account`, `api_key`.
- Cập nhật `sdk-convention.md` (resource admin mới, subject mới).

**Xong khi.** Integration test: tạo user; đổi role của admin active cuối cùng → lỗi; đổi role user khác
→ session cũ của user đó bị revoke; `member` gọi `/admin/users` → 403; `/admin/account` bằng API key → 403. Test resource SDK xanh. `packages/sdk/src/bundle.test.ts` xanh.

**Công sức: M.**

---

## Phase 28 — Hook SDK còn thiếu

**Mục tiêu.** Mọi method admin-facing của SDK có một hook, để UI không bao giờ phải gọi resource trực
tiếp.

**Vì sao ở đây.** "Tích hợp toàn bộ SDK" ở phase 30–32 là nối hook vào màn; hook phải có trước.

**Deliverables.** Theo đúng hình dạng hook hiện có (key factory, `usePinstripeQueries()`, mutation
invalidate `_def` trước rồi mới gọi callback của provider, `successMessage` do call site truyền):

| Domain               | Hook mới                                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| subscriptions        | `useSubscriptionItemsQuery`, `useSubscriptionItemQuery`, `useCreate/Update/DeleteSubscriptionItemMutation`                                                                                                |
| invoices             | `useCreditNoteQuery`, `useVoidCreditNoteMutation`                                                                                                                                                         |
| discounts            | `usePromotionCodeQuery`                                                                                                                                                                                   |
| tax (mới)            | `useTaxRatesQuery`, `useTaxRateQuery`, `useCreate/UpdateTaxRateMutation`, `useTaxIdsQuery`, `useTaxIdQuery`, `useCreate/DeleteTaxIdMutation`                                                              |
| payment-links (mới)  | `usePaymentLinksQuery`, `usePaymentLinkQuery`, `useCreate/UpdatePaymentLinkMutation`                                                                                                                      |
| checkout (mới)       | `useCheckoutSessionsQuery`, `useCheckoutSessionQuery`, `useCreateCheckoutSessionMutation`                                                                                                                 |
| billing-portal (mới) | `useBillingPortalConfigurationsQuery`, `useBillingPortalConfigurationQuery`, `useCreate/UpdateBillingPortalConfigurationMutation`, `useCreateBillingPortalSessionMutation`, `useCreatePortalLinkMutation` |
| payments             | `usePaymentIntentQuery`, `useCancelPaymentIntentMutation`, `useRefundQuery`                                                                                                                               |
| webhooks             | `useWebhookEndpointQuery`                                                                                                                                                                                 |
| meters               | `useCreateMeterEventBatchMutation`                                                                                                                                                                        |
| test-clocks          | `useTestClockQuery`                                                                                                                                                                                       |
| ledger               | `useLedgerAccountQuery`                                                                                                                                                                                   |

Subject mới: `tax`, `payment_link`, `checkout`, `billing_portal`. Đăng ký key file mới vào
`createPinstripeQueries`. Barrel cập nhật.

Không thêm method SDK cho route không tồn tại (`sdk-convention.md`). Không tạo hook cho `portal.*` ngoài
`portal.links.create` — phần còn lại thuộc `portal-ui`.

**Xong khi.** typecheck, test, `bundle.test.ts` xanh. Một test trong SDK liệt kê mọi method của mọi
resource (trừ `portal.*` ngoài `links.create`, ghi rõ danh sách ngoại lệ trong test) và khẳng định mỗi
method có ít nhất một hook gọi tới.

**Công sức: L.**

---

## Phase 29 — admin-ui nền

**Mục tiêu.** Một shell đúng mockup, trên HeroUI, có đăng nhập thật — và trang cũ vẫn chạy bên trong.

**Vì sao ở đây.** Cần session (25), authorization (26) và `useAccountQuery` (27). Mọi màn ở 30–32 lắp
vào shell này.

**Deliverables.**

- Dependency theo bảng "Sự thật nền". Nâng `tailwind-merge` lên ^3. Xoá `src/components/ui/*`.
- `src/index.css`: import Tailwind + HeroUI + better-auth-ui styles; biến CSS của HeroUI lấy từ bảng
  token của mockup; bỏ khối `@theme` cũ.
- `src/lib/auth-client.ts` — file **duy nhất** import `better-auth`:
  `createAuthClient({ basePath: '/api/v1/auth', fetchOptions: { customFetchImpl } })`, trong đó
  `customFetchImpl` bóc body lỗi `{ error: { code, message } }` thành `{ code, message }`.
- Chặn import `better-auth*` ngoài file đó bằng `no-restricted-imports` trong `apps/admin-ui/eslint.config.js`.
- `src/lib/pinstripe.tsx`: `new PinstripeClient()` không key — trình duyệt đi bằng cookie.
- `vite.config.ts`: bỏ `headers` chèn key; giữ proxy `/api` và `/v1` với `changeOrigin`.
- `main.tsx`: `QueryClientProvider` → `AdminPinstripeProvider` → `BrowserRouter` → `AuthProvider`
  (`authClient`, `navigate` từ react-router, `Link`, `queryClient` dùng chung, `redirectTo: '/'`,
  `emailAndPassword: { enabled: true, forgotPassword: false, minPasswordLength: 12 }`, Google chỉ khi
  bật, `localization` tiếng Việt).
- Route: `/auth/:path` (sign-in, sign-out; giấu sign-up theo bẫy #3); `/settings/account`
  (`UserProfile`); `/settings/security` (`ChangePassword` + nút đăng xuất thiết bị khác). Mọi route còn
  lại nằm dưới `RequireSession` và `AppLayout`.
- `src/lib/permissions.ts`: `useCan(permission)` dựa trên `useAccountQuery`.
- Component dùng chung trong `src/components/` (một default export mỗi file, theo component-convention):
  `AppLayout`, `AppSidebar`, `AppTopbar`, `PageCard`, `StatGrid`, `StatItem`, `FilterBar`, `DataTable`
  (HeroUI `Table`, dòng compact, click cả dòng, empty state, phân trang cursor từ `ListResponse.hasMore`),
  `StatusChip`, `EntityDrawer` (HeroUI Drawer; nếu v3 không có thì Modal đặt dạng sheet phải),
  `ConfirmDialog`, và `components/fields/Render{Text,Select,Number,Date,Checkbox}Field` (HeroUI bọc
  `Controller` của react-hook-form).
- `src/lib/format.ts`: tiền từ minor unit, ngày `dd/MM/yyyy`.
- 13 trang cũ tạm render nguyên trong `PageCard` của shell mới, sidebar trỏ tới chúng — thay dần ở 30–32.
- Vitest cho admin-ui, chỉ test logic: `format.ts`, `useCan`, adapter lỗi của `auth-client`.
- `.claude/rules/local/admin-ui-convention.md`: shell, công thức một màn, drawer, nguồn token, `useCan`,
  quy tắc chỉ `auth-client.ts` được import `better-auth`.

**Xong khi.** `pnpm --filter @pinstripe/admin-ui build` xanh; test logic xanh; lint bắt được một import
`better-auth` đặt thử ngoài `auth-client.ts` (test hoặc chứng minh bằng cấu hình rule); `vite.config.ts`
không còn chứa `PINSTRIPE_ADMIN_API_KEY` / `PINSTRIPE_SECRET_API_KEY`.

**Công sức: XL.**

---

## Phase 30 — Màn Sales

**Mục tiêu.** Nhóm Sales của mockup, trên domain pinstripe, dùng hết hook của các domain đó.

**Vì sao ở đây.** Shell và hook đã có.

**Deliverables.** Mọi màn theo công thức của mockup (stats → filter → bảng → drawer). Page giữ
`useForm` và mutation, component `…Form` chỉ hiển thị (form-convention); tái dùng `src/forms/*`. Nút ghi
ẩn theo `useCan`.

- **Customers** `/customers`, detail `/customers/:customerId`: tab Chi tiết (update, delete), Balance
  transactions (list + create), Tax IDs (list, create, delete), Subscriptions, Invoices; action "Tạo link
  portal" (`useCreatePortalLinkMutation`) và "Mở billing portal" (`useCreateBillingPortalSessionMutation`).
- **Products & Prices** `/catalog`: tab Catalog (drawer product + các price của nó, tái dùng logic tier
  của `PriceForm`) và Prices (tạo, sửa).
- **Subscriptions** `/subscriptions`: tab Subscriptions (drawer: Chi tiết — customer, collection method,
  lưới item qua subscriptionItems CRUD, update, cancel; Entitlements; Hoá đơn sắp tới — thay `RatingPage`),
  Usage-based billing (meters: định nghĩa event, tạo/sửa; event summary; tạo event và batch), Coupons & mã
  KM (coupon CRUD, promotion code, discount gắn subscription), Thuế (tax rates).
- **Checkout & Portal** `/checkout`: Payment links, Checkout sessions (list, tạo, chi tiết), Portal
  configurations.
- Xoá `RatingPage` và trang cũ của các domain trên khi màn mới thay xong.

**Xong khi.** build, lint, typecheck xanh. Một test trong admin-ui đọc danh sách export của
`@pinstripe/sdk/react` cho các domain customers, products, prices, subscriptions, entitlements, meters,
discounts, tax, payment-links, checkout, billing-portal và khẳng định mỗi hook được import ở ít nhất một
file dưới `src/pages`.

**Công sức: XL.**

---

## Phase 31 — Màn Finance + Tổng quan

**Mục tiêu.** Nhóm Finance của mockup, và trang Tổng quan.

**Vì sao ở đây.** Invoices tham chiếu customer và subscription — cần màn Sales có trước để link qua lại.

**Deliverables.**

- **Invoices** `/invoices`: tab theo trạng thái (draft / open / paid / void / uncollectible) có đếm, như
  tab ĐNTT của mockup. Drawer: Chi tiết (dòng, tổng, invoice items CRUD khi còn draft,
  finalize / pay / void / charge), Credit notes (list, tạo, chi tiết, void).
- **Payments** `/payments`: Payment intents (chi tiết, cancel), Refunds (tạo, chi tiết).
- **Ledger** `/ledger`: Accounts (chi tiết), Transactions (tạo, reverse, chi tiết).
- **Reports** `/reports`: revenue summary, reconciliation report.
- **Tổng quan** `/`: stat từ revenue summary + một khối reconciliation ngắn.
- Xoá trang cũ tương ứng.

**Xong khi.** Như phase 30, cho các domain invoices, payments, ledger, reporting.

**Công sức: L.**

---

## Phase 32 — Developers + Admin, dọn dẹp

**Mục tiêu.** Xong nốt màn, không còn code cũ, rule và docs khớp với code.

**Vì sao ở đây.** Cuối cùng vì nó là nơi gom mọi thứ lại.

**Deliverables.**

- **Webhooks** `/webhooks`: Endpoints (tạo, sửa, chi tiết), Deliveries.
- **API keys** `/api-keys`: list, tạo (secret chỉ hiện một lần, có nút copy), revoke.
- **Test clocks** `/test-clocks`: list, tạo, advance, chi tiết.
- **Admin Users** `/admin/users`: tìm, role dạng chip sửa inline, bật/tắt trạng thái, tạo user, đặt lại
  mật khẩu. Lỗi "admin cuối cùng" hiện qua toast từ provider.
- **Roles** `/admin/roles`: bảng admin / moderator / member, ma trận `ROLE_PERMISSIONS`, số user mỗi role.
  Chỉ đọc.
- Xoá mọi page / component cũ không còn được import.
- Chốt `auth-convention.md`, `sdk-convention.md`, `admin-ui-convention.md` với code cuối cùng.
- `AGENTS.md` / README: bỏ hướng dẫn proxy chèn key; env mới; cách tạo admin đầu tiên
  (`POST /api/v1/management/users/bootstrap`).
- ADR trong `docs/adr/` (đánh số tiếp): một cho auth dashboard + session authorization, một cho kiến trúc
  admin-ui (HeroUI, drawer, `useCan`).

**Xong khi.** Test "mọi hook đều được dùng" chạy trên **toàn bộ** export của `@pinstripe/sdk/react`, danh
sách ngoại lệ rỗng, và xanh. build, lint, typecheck, test, integration xanh.

**Công sức: L.**

---

## Việc cần người

Agent chạy đêm không làm được những việc sau; chúng là bước nghiệm thu sau khi các PR merge:

- Mở dashboard cạnh mockup và so bằng mắt: sidebar, top bar, page card, bảng, drawer.
- Đăng nhập Google thật với domain trong `GOOGLE_OAUTH_ALLOWED_DOMAIN`.
- Tạo admin đầu tiên trên môi trường thật và cất mật khẩu.
- Chạy một vòng click qua mọi màn: tạo, sửa, xoá, finalize/pay/void, advance test clock, reverse ledger,
  đổi role, thử hạ quyền admin cuối cùng.
