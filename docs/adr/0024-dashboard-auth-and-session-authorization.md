# 0024 — Đăng nhập dashboard và authorization theo session

- **Trạng thái.** Accepted
- **Xây trên.** [0001 — Nền móng](0001-phase-0-foundation.md)

## Bối cảnh

Đến trước quyết định này, `apps/admin-ui` gọi được API **chỉ vì** Vite dev proxy chèn
`PINSTRIPE_ADMIN_API_KEY` / `PINSTRIPE_SECRET_API_KEY` vào mọi request. Hệ quả: không có người dùng,
không có vai trò, không có audit ai làm gì — và một bản build ra khỏi `vite dev` không xác thực được
gì cả. `authenticateRequest` chỉ biết một đường: `Authorization: Bearer <api key>`.

RBAC đã tồn tại trong `packages/core/src/contracts/users.types.ts` (`UserRoleEnum`, 14 member của
`PermissionEnum`, `ROLE_PERMISSIONS`) và `UserService` đã có luật của nó, nhưng **chưa ai đọc**: không
có route `/api/v1/auth/*`, không có route `/api/v1/admin/users`, không có đường tạo admin đầu tiên.

## Quyết định

### 1. better-auth ra trình duyệt qua một cửa hẹp, có allowlist

Route catch-all `/api/v1/auth/*` forward tới `betterAuth.handler`, nhưng chỉ cho đúng chín path:
`/sign-in/email`, `/sign-in/social`, `/callback/google`, `/sign-out`, `/get-session`,
`/change-password`, `/list-accounts`, `/revoke-other-sessions`, `/update-user`. Path khác trả `404`.

Danh sách này là **đóng**, và hai nhóm bị bỏ ra có lý do khác nhau:

- `/admin/*` của plugin better-auth đi vòng qua luật admin active cuối cùng và qua audit. Quản trị
  user đi qua `UserService` + SDK `admin.users`, không bao giờ qua đó.
- `/list-sessions` và `/revoke-session` cần **token session thô**, mà token cố tình không ra khỏi
  server. Card `ActiveSessions` của better-auth-ui vì thế bị bỏ, thay bằng một nút gọi
  `/revoke-other-sessions`.
- `/sign-up/*` 404 với mọi caller: server đặt `disableSignUp: true`.

Đây là ngoại lệ có chủ ý của `fastify/route-convention.md` §"Every route declares a schema" — handler
của better-auth tự validate body. Bù lại route phải làm năm việc, mỗi việc chữa một lỗ thật:

1. **Check `Origin === ADMIN_UI_ORIGIN` cho mọi POST.** better-auth 1.7 **không** chặn Origin lạ ở
   `/sign-in/email` (probe thấy trả 200), nên login CSRF phải chặn ở phía mình. GET không check vì
   callback Google là một GET cross-site.
2. **Không trả `token` ra body** — xoá `token` ở top-level của sign-in và `session.token` của
   `/get-session`.
3. **Map lỗi non-2xx sang `AppError`**, nhưng **giữ `code` gốc** của better-auth, để
   `INVALID_EMAIL_OR_PASSWORD` đến được UI.
4. **`/update-user` chỉ nhận `name` và `image`.** Đó là đường duy nhất browser chạm tới bản ghi user,
   và `role` không đi qua đó.
5. **`/get-session` đi qua `findActiveSession`**, helper đọc `session.createdAt` và revoke khi quá
   `ADMIN_SESSION_ABSOLUTE_TTL_HOURS` — idle TTL của better-auth không biết gì về TTL tuyệt đối.

**Body 2xx giữ nguyên shape của vendor.** `@better-auth-ui/heroui` đọc thẳng `data.user` và
`data.session.id`; đổi sang envelope `{ data }` của repo là gãy toàn bộ UI auth. Đây là chỗ duy nhất
trong repo một response 2xx không đi qua `ApiResponse`.

### 2. `authenticateRequest` có hai đường, thứ tự cố định

```
Bearer <api key>  → đường API key, không đổi gì
cookie pinstripe.* và scope ∈ { v1, admin } → session
không có cả hai → UnauthorizedError
```

Session gán `request.actor: UserAuth` với `permissions = ROLE_PERMISSIONS[role]`; API key vẫn gán
`request.auth: RequestAuth`. Hai field, hai vai, không trộn.

Cookie session **không** xác thực được `system`, `management`, `portal` hay `hosted`. Đó là surface của
machine caller; mở cho browser là mở một đường đi vòng qua chính API key mà chúng dùng để phân biệt
caller. Cookie là `SameSite=Lax` (mặc định better-auth, không đổi sang `Strict` vì callback Google là
GET cross-site), nên nhánh session lặp lại check Origin cho mọi request không phải GET.

### 3. Permission của route resolve từ `operationId`, fail closed

`verifyApiRequest` / `verifyAdminRequest` gọi `authorizeRequest` ngay sau khi xác thực. Request đi bằng
API key không bị chạm — scope của key vẫn là thứ quyết định. Request đi bằng session phải mang
permission mà route đòi, và permission đó đến từ đúng hai nguồn:

| Loại route | Nguồn                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| v1         | `schema.operationId` dạng `<resource>.<method>`; `find*` / `get*` → `billing.read`, còn lại tra `OPERATION_PERMISSIONS` |
| admin      | `config: buildRouteConfig(<permission>)` khai trên chính route                                                          |

Không resolve được → `ForbiddenError`. **Fail closed**: một route mới quên khai permission thì session
không vào được, chứ không mở toang. Một test đọc mọi `operationId` trong `apps/api/openapi.json` sẽ đỏ
khi thiếu một dòng trong `OPERATION_PERMISSIONS`.

`buildRouteConfig` tồn tại vì một object literal inline làm `ContextConfig` của Fastify suy ra
`undefined`; helper trả `FastifyContextConfig` là chỗ chữa.

### 4. Ghi user chỉ qua `UserService`, và không có route xoá

`UserService` giữ luật không cho hạ quyền hay ban **admin active cuối cùng**, và revoke session khi
role, trạng thái ban hoặc password đổi. `BetterAuthClient` dùng `internalAdapter` cho các thao tác
này, vì endpoint `/admin/*` của plugin bắt buộc phải có session admin — mà ở đây không có.

Bề mặt quản trị user vì thế chỉ có `find` / `get` / `create` / `update`. Xoá user **không phải một
route**: vô hiệu hoá đi qua `update`, để luật admin cuối cùng còn chỗ chạy.

Admin đầu tiên tạo bằng `POST /api/v1/management/users/bootstrap` (`verifyManagementRequest`,
`UserService.ensureUser`, role `admin`, idempotent).

### 5. Bảng auth theo shape của vendor

`users`, `admin_sessions`, `user_accounts`, `auth_verifications` do better-auth đọc/ghi qua drizzle
adapter, nên timestamp dùng `timestamp({ withTimezone: true, mode: 'date' })` chứ không `isoTimestamp`
— adapter đọc và ghi `Date`. Đây là ngoại lệ với
[0021 — ISO timestamps](0021-iso-timestamps-and-no-object-field.md), và nó dừng ở bốn bảng đó.

Id vẫn sinh qua `generateGid` (`usr` / `ases` / `uacc` / `aver`). `admin_sessions.token` lưu thô;
cookie là `token.signature` ký bằng `BETTER_AUTH_SECRET`, nên người đọc được DB mà không có secret vẫn
không giả được cookie.

## Hệ quả

- **Không có email sender.** Quên mật khẩu, đổi email và xác minh email đều chưa mở. Đặt lại mật khẩu
  là việc của admin, ở `/admin/users`.
- **Session không xem được danh sách thiết bị.** Đổi lại: token không rời server. Muốn đá mọi thiết bị
  khác thì có một nút, không có danh sách.
- **Thêm một route v1 là hai việc, không phải một**: khai `operationId`, và nếu là resource mới thì
  thêm một dòng vào `OPERATION_PERMISSIONS`. Quên việc thứ hai thì route đó đóng với mọi session.
- **`ROLE_PERMISSIONS` là hằng số của code, không phải dữ liệu.** Đổi quyền của một vai trò là một PR,
  không phải một thao tác trên dashboard. `/admin/roles` chỉ đọc.
- **Rate limit phải biết hai loại caller**: key theo `actor.userId` cho session, theo `auth.apiKeyId`
  cho API key.

## Cân nhắc đã bỏ

- **Dùng plugin `admin` của better-auth cho quản trị user.** Nó gọi `/admin/*`, đi vòng qua luật admin
  active cuối cùng và qua audit — đúng thứ đang cần giữ.
- **Trả session body theo envelope của repo.** better-auth-ui đọc thẳng shape của vendor; đổi là viết
  lại toàn bộ UI auth để đổi lấy một sự nhất quán không ai đọc.
- **Cho cookie session xác thực mọi surface.** `system` / `management` / `portal` dùng API key để
  **phân biệt caller**; cho browser vào là xoá chính sự phân biệt đó.
- **Mặc định cho qua khi không resolve được permission.** Một route mới quên khai sẽ mở toang, và
  không có gì báo.
- **`isoTimestamp` cho bảng auth.** Adapter của vendor đọc `Date`; ép kiểu ở đây là sửa vendor bằng
  schema.
