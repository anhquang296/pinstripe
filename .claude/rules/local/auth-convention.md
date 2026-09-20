# Auth Convention

Dashboard đăng nhập qua better-auth, còn quyền và audit là code của repo. Chỗ nối hai bên lệch với kit ở vài điểm, và nếu không ghi lại, agent tiếp theo sẽ "sửa" chúng về đúng chữ của kit rồi làm hỏng login, hoặc tệ hơn là tự mở ra một lỗ bảo mật mà better-auth không chặn giúp.

## Scope

Applies to:

- `packages/core/src/clients/better-auth.client.ts`, `plugins/better-auth.plugin.ts`, `database/schemas/auth.schema.ts`
- `packages/core/src/services/user.service.ts`
- `apps/api/src/routes/auth/**` (mount tại `/v1/auth`) và các hook xác thực trong `apps/api/src/hooks/`

Does **not** apply to:

- Machine caller dùng API key. Đường API key + scope giữ nguyên như cũ.
- Portal session của khách hàng (`portal_sessions`), vì đó là một cơ chế khác.

## Bảng auth theo shape của vendor

`users`, `admin_sessions`, `user_accounts`, `auth_verifications` do better-auth đọc/ghi qua drizzle adapter.

- Timestamp của các bảng này dùng `timestamp({ withTimezone: true, mode: 'date' })`, **không** dùng `isoTimestamp`, vì adapter đọc và ghi `Date`.
- Password nằm ở `user_accounts.password` (provider `credential`), không nằm trong `users`.
- `admin_sessions.token` được lưu thô. Cookie là `token.signature` ký bằng `BETTER_AUTH_SECRET`, nên người đọc được DB mà không có secret vẫn không giả được cookie. Giữ secret ngoài DB.
- Các cột nullable như `image`, `ban_reason`, `ban_expires` là shape của vendor, nằm ngoài phạm vi `nullability-convention.md`. Cột do mình quyết thì vẫn tuân theo rule: `role` và `banned` đều `NOT NULL`.
- Id được sinh qua `generateGid` với prefix `usr` / `ases` / `uacc` / `aver`. Không đổi sang id mặc định của better-auth.

## Ghi user chỉ qua `UserService`

- Mọi thao tác tạo user, đổi role, ban hay đặt password đều đi qua `UserService`. Service giữ luật không cho hạ quyền hay ban admin active cuối cùng, và revoke session khi role, trạng thái ban hoặc password đổi.
- `BetterAuthClient` dùng `internalAdapter` cho các thao tác này, vì endpoint `/admin/*` của plugin bắt buộc phải có session admin.
- **Endpoint `/admin/*` của better-auth không được mở ra browser.** Route catch-all chỉ forward một allowlist path; path khác trả 404. Nếu mở ra thì browser sẽ có đường đổi role đi vòng qua luật admin cuối cùng và qua audit.

## Route catch-all `/v1/auth/*`

Đây là ngoại lệ có chủ ý của `fastify/route-convention.md` §"Every route declares a schema": handler của better-auth tự validate body. Bù lại, route **bắt buộc** làm năm việc sau.

- **Check `Origin === ADMIN_UI_ORIGIN` cho mọi POST.** better-auth 1.7 **không** chặn Origin lạ ở `/sign-in/email` (probe thấy trả 200), nên login CSRF phải được chặn ở phía mình. GET không check, vì callback Google là một GET cross-site.
- **`basePath` của better-auth là `/v1/auth`**, khai một lần trong `better-auth.plugin.ts`; `auth-client.ts` của admin-ui phải khai đúng chuỗi đó.
- **Không trả `token` ra body.** Body 2xx giữ nguyên shape của vendor — `@better-auth-ui/heroui` đọc thẳng `data.user` và `data.session.id`, đổi sang envelope của repo là gãy toàn bộ UI auth — nhưng route xoá `token` (top-level ở sign-in, `session.token` ở `/get-session`).
- **Map lỗi non-2xx sang `AppError`** (`UnauthorizedError`, `ForbiddenError`, `BadRequestError`…), để SDK chỉ phải xử lý một envelope `PinstripeError`. **Giữ `code` gốc của better-auth** làm `code` của envelope: `INVALID_EMAIL_OR_PASSWORD` phải đến được UI, nếu không mọi lỗi login rơi về một thông báo chung chung.
- **`/update-user` chỉ nhận key `name` và `image`.** Key khác → `BadRequestError`; đó là đường duy nhất browser chạm được tới bản ghi user, và role không đi qua đó.
- **`/get-session` đi qua `BetterAuthClient.findActiveSession`**, chứ không forward thẳng: helper đọc `session.createdAt`, quá `ADMIN_SESSION_ABSOLUTE_TTL_HOURS` thì `revokeSession` và trả `null`. Idle TTL của better-auth không biết gì về TTL tuyệt đối.

```ts
// CORRECT — allowlist, rồi mới forward
const AUTH_PATHS = [
  '/sign-in/email',
  '/sign-in/social',
  '/callback/google',
  '/sign-out',
  '/get-session',
  '/change-password',
  '/list-accounts',
  '/revoke-other-sessions',
  '/update-user',
];

// WRONG — forward mọi thứ, /admin/* và /sign-up/* lộ ra browser
fastify.all('/*', async (request, reply) => {
  return forward(request, reply);
});
```

Allowlist trên là đóng. `/list-sessions` và `/revoke-session` **không** được mở: cả hai cần token session thô, mà token cố tình không ra khỏi server — nên card `ActiveSessions` của better-auth-ui bị bỏ, thay bằng nút "đăng xuất thiết bị khác" trên `/revoke-other-sessions`.

Admin đầu tiên được tạo bằng CLI `pnpm --filter @pinstripe/api bootstrap-admin -- --email … --name …`
(`apps/api/scripts/bootstrap-admin.ts`, dựng Fastify headless với `corePlugin`, gọi
`UserService.ensureUser`, role `admin`, idempotent) — không phải bằng một route HTTP, và không phải
bằng `/sign-up/*`, thứ vẫn 404 với mọi caller.

## Hai đường xác thực, một đường phân quyền

`authenticateRequest(request, reply)` **không nhận scope**. Đúng hai đường, thứ tự cố định:

1. Có `Authorization: Bearer <api key>` → `apiKeyService.authenticateApiKey`; gán `request.auth: RequestAuth` mang `permissions`.
2. Không có Bearer nhưng có cookie `pinstripe.*` → `BetterAuthClient.findActiveSession`; gán `request.actor: UserAuth` với `permissions = ROLE_PERMISSIONS[role]`. Kiểu `actor` khai cạnh `auth` trong `apps/api/src/plugins/api-key.plugin.ts`.
3. Không có cả hai → `UnauthorizedError`.

`authorizeRequest(request)` chạy **cho cả hai đường**: lấy `permissions` từ `actor` hoặc `auth`, so
với permission của route, không khớp → `ForbiddenError`. API key không còn được đi vòng qua
authorization — xem ADR 0028.

Cookie session chỉ tới được product API, vì nó là nơi duy nhất gọi `authenticateRequest`. Bốn surface
còn lại có hook riêng không đụng tới cookie: `verifyPortalKeyRequest` gọi thẳng `authenticateApiKey`
rồi đòi `portal.write`, `verifyPortalSessionRequest` đòi Bearer session key, `verifyHostedRequest`
đòi `token` đã ký, `verifyPspCallbackRequest` đòi chữ ký HMAC.

Session bị từ chối bằng `UnauthorizedError` khi không có session, khi `user.banned`, khi `role` không thuộc `UserRoleEnum`, hoặc khi quá TTL tuyệt đối — `findActiveSession` lo nốt việc `revokeSession`. Request không phải GET mà `Origin !== ADMIN_UI_ORIGIN` → `ForbiddenError`; đó là CSRF check, và nó ở đây vì cookie là `SameSite=Lax`.

## API key mang permission, không mang scope

`api_keys.permissions` là một mảng `PermissionEnum` — **không** có `ApiKeyScopeEnum`, enum đó đã bị
xoá. `SECRET` mang toàn bộ permission, `RESTRICTED` mang đúng tập được cấp lúc tạo, `PUBLISHABLE`
mang `[portal.write]`.

`ROLE_PERMISSIONS[ADMIN]` là hằng `ADMIN_PERMISSIONS` liệt kê tường minh, **không** phải
`Object.values(PermissionEnum)`: `portal.write` là quyền của machine caller, và `Object.values` sẽ
âm thầm cấp nó — cùng mọi permission phi-dashboard thêm về sau — cho role admin.

`ADMIN_UI_ORIGIN` đọc qua `fastify.betterAuth.baseUrl`, không đọc `fastify.config` — hook không phải plugin.

## Permission theo route, fail closed

`verifyApiRequest` gọi `authorizeRequest(request)` ngay sau khi xác thực, và nó áp cho **cả** API key lẫn session.

Permission của một route resolve theo đúng hai nguồn, ở `apps/api/src/utils/route-permission.ts`, theo thứ tự này:

1. `config: buildRouteConfig(<permission>)` khai trên chính route. Object literal inline không dùng được — `ContextConfig` của Fastify suy ra `undefined`; helper trả `FastifyContextConfig` là chỗ chữa.
2. `schema.operationId` (`<resource>.<method>`, resource lồng được): tra `OPERATION_PERMISSIONS` (`apps/api/src/constants/permissions.ts`) theo **full `<resource>.<method>` trước**, rồi mới tới shortcut "method bắt đầu bằng `find` / `get` → `billing.read`", rồi mới tới `<resource>`.

Thứ tự trong (2) là bắt buộc và không được đảo lại: shortcut read chạy trước thì `GET /v1/users` và `GET /v1/api_keys` rơi về `billing.read`, tức mọi role đọc được danh sách người dùng và danh sách khoá. Vì thế `users.find`, `users.get`, `apiKeys.find` có entry riêng trong `OPERATION_PERMISSIONS`.

Không resolve được permission → `ForbiddenError`. **Fail closed**: một route mới quên khai permission thì không ai vào được, chứ không mở toang. Route v1 mới thêm phải khai `operationId` và, nếu resource mới, thêm một dòng vào `OPERATION_PERMISSIONS` — test đọc mọi `operationId` trong `apps/api/openapi.json` sẽ đỏ khi thiếu.

`rate-limit.plugin.ts` key theo `actor.userId` cho session, theo `auth.apiKeyId` cho API key.

## Frontend và SDK

- SDK không import `better-auth`. SDK bọc các path trong allowlist thành resource `auth.*` giống mọi resource khác.
- `better-auth/react` được phép ở **đúng một file của admin-ui**: `apps/admin-ui/src/libs/auth-client.ts`, và chỉ để dựng `createAuthClient` cho `@better-auth-ui/heroui`. Client đó **phải** override `basePath: '/v1/auth'`. Mọi domain call khác đi qua `@pinstripe/sdk` — một file thứ hai import `better-auth/react` là HTTP client thứ hai, trái với `sdk-convention.md`.
- **Không** dùng `adminClient()` hay plugin `admin` của better-auth-ui. Chúng gọi `/admin/*`, đi vòng qua luật admin active cuối cùng và qua audit; quản trị user đi qua `UserService` + SDK.
- Browser và API phải cùng origin (reverse proxy, hoặc Vite proxy khi dev). Cookie là `SameSite=Lax` (mặc định của better-auth), không đổi sang `Strict`, vì callback Google là một GET cross-site.

## Env

`BETTER_AUTH_SECRET` (min 32), `ADMIN_UI_ORIGIN`, `ADMIN_SESSION_IDLE_TTL_MINUTES`, `ADMIN_SESSION_ABSOLUTE_TTL_HOURS`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_ALLOWED_DOMAIN`.

Chỉ đọc chúng trong `better-auth.plugin.ts`; client nhận config đã resolve. Google chỉ bật khi đủ cả ba biến `GOOGLE_OAUTH_*`.

## NEVER Do

- Forward một path ngoài allowlist tới handler của better-auth, nhất là `/admin/*` và `/sign-up/*`.
- Mở `/list-sessions` hay `/revoke-session` — chúng cần token session thô.
- Trả nguyên body sign-in của better-auth, vì trong đó có `token`, ra cho browser; hoặc đổi body 2xx sang envelope của repo, vì better-auth-ui đọc thẳng shape của vendor.
- Nuốt `code` của better-auth khi map lỗi sang `AppError`.
- Nhận key ngoài `name` / `image` ở `/update-user`.
- Bỏ check `Origin` ở route auth, hay ở nhánh session của `authenticateRequest`, với lý do better-auth đã tự check.
- Cho `authenticateRequest` nhận lại một tham số surface, hay cho một hook của surface máy gọi máy (`portal` key, `hosted`, `webhooks`) đọc cookie session.
- Cho request đi bằng API key bỏ qua `authorizeRequest` — permission áp cho cả hai đường.
- Dựng lại `ApiKeyScopeEnum`, hay cho `ROLE_PERMISSIONS[ADMIN]` quay về `Object.values(PermissionEnum)`.
- Đảo thứ tự resolve trong `resolveOperationPermission` để shortcut `find` / `get` chạy trước override theo full `operationId`.
- Mở một route khi không resolve được permission của nó — thiếu permission là `ForbiddenError`, không phải mặc định cho qua.
- Thêm route v1 mà không khai `operationId`, hay thêm resource mới mà không thêm dòng tương ứng vào `OPERATION_PERMISSIONS`.
- Khai `config: { permission }` bằng object literal inline trên route — dùng `buildRouteConfig`.
- Đổi role, ban hay đặt password bằng cách gọi thẳng `fastify.betterAuth` từ route; đi qua `UserService`.
- Dùng `isoTimestamp` trên bảng auth, hoặc đổi id của chúng sang id mặc định của better-auth.
- Import `better-auth` vào `packages/sdk`, hay `better-auth/react` vào bất kỳ file nào của admin-ui ngoài `src/libs/auth-client.ts`.
- Dựng lại một route HTTP tạo admin đầu tiên — nó là CLI `bootstrap-admin`.
- Dùng `adminClient()` hay plugin `admin` của better-auth-ui.
- Đặt cookie auth `SameSite=Strict`.
