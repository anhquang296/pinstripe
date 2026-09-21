# 0029 — Đổi tên dự án thành `vxrerp`, pinstripe trở thành module billing

- **Trạng thái.** Accepted
- **Sửa một phần.** Mọi ADR trước đó nhắc tên `pinstripe`, `admin-ui`, `portal-ui`. ADR 0001–0028 giữ
  nguyên chữ cũ vì chúng là lịch sử; bảng dưới đây là cách đọc chúng theo tên hiện tại.

## Bối cảnh

Repo này không còn là một sản phẩm billing đứng riêng. Nó trở thành ERP nội bộ của Vexere, thay
HubSpot. Billing là module đầu tiên; CRM (company, contact, deal) sẽ là module tiếp theo và cũng là
bản gốc của master data nhà xe. Giữ tên `pinstripe` cho cả monorepo thì mọi package, env và hook đều
nói tên của một module, và module thứ hai sẽ phải sống dưới tên của module thứ nhất.

Dự án chưa lên production. Không có webhook consumer, API key đã cấp hay nhà xe nào đang dùng portal,
nên đổi được cả các định danh runtime mà không cần một giai đoạn song song.

## Quyết định

Quy ước tên: scope `@vxrerp`, định danh `VxrErp`, hằng và env `VXRERP`, tên file kebab-case `vxr-erp`,
biến camelCase `vxrErp`, chữ hiển thị "VXR ERP".

| Loại            | Cũ                                                                  | Mới                                                        |
| --------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Root package    | `pinstripe`                                                         | `vxrerp`                                                   |
| Workspace scope | `@pinstripe/*`                                                      | `@vxrerp/*`                                                |
| App nội bộ      | `apps/admin-ui`, `@pinstripe/admin-ui`                              | `apps/erp-ui`, `@vxrerp/erp-ui`                            |
| Cổng nhà xe     | `apps/portal-ui`, `@pinstripe/portal-ui`                            | `apps/operator-portal`, `@vxrerp/operator-portal`          |
| SDK             | `PinstripeClient`, `PinstripeError`, `usePinstripe*`…               | `VxrErpClient`, `VxrErpError`, `useVxrErp*`…               |
| Query subject   | `PinstripeQuerySubjectEnum`                                         | `VxrErpQuerySubjectEnum`                                   |
| Env của SDK/BFF | `PINSTRIPE_*`                                                       | `VXRERP_*`                                                 |
| Cookie session  | `pinstripe.session_token`, `pinstripe_portal_session`               | `vxrerp.session_token`, `vxrerp_portal_session`            |
| Header          | `pinstripe-signature`, `pinstripe-version`, `x-pinstripe-client-ip` | `vxrerp-signature`, `vxrerp-version`, `x-vxrerp-client-ip` |
| Redis           | `REDIS_KEY_PREFIX` mặc định `pinstripe`                             | `vxrerp`                                                   |
| Docker local    | project, user, password, db `pinstripe`                             | `vxrerp`                                                   |
| localStorage    | `pinstripe-report-range`                                            | `vxrerp-report-range`                                      |
| ESLint          | `ignoreObjects: ['^pinstripe\\.']`                                  | `['^vxrErp\\.']`                                           |

Những thứ **không** đổi:

- API surface, `operationId` và `openapi.json`: không một operation nào đổi, spec sinh lại giống hệt.
- `/v1/portal/**` và `portal.*` của SDK. `portal` từ nay được đọc là **cổng nhà xe**; nhóm người dùng
  bên ngoài thứ hai, nếu có, mang tiền tố của chính nhóm đó (`/v1/vendor_portal`, `vendorPortal.*`).
- `ADMIN_UI_ORIGIN`: env của server API, nói về origin chứ không về tên app.
- Thư mục repo và remote Git.

## Hệ quả

- Môi trường local phải dựng lại compose (`vxrerp-*`), migrate và seed lại, sửa `.env` theo tên mới,
  và đăng nhập lại vì cookie đổi tên. Volume của project compose `pinstripe` cũ không bị xoá.
- Bước tiếp theo là tách `@vxrerp/core` thành `@vxrerp/platform` và `@vxrerp/billing`; tên `billing`
  thay cho pinstripe trong vai trò một module.
