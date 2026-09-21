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
| Cổng nhà xe     | `apps/portal-ui`, `@pinstripe/portal-ui`                            | `apps/billing-portal-ui`, `@vxrerp/billing-portal-ui`      |
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
- `/v1/portal/**` và `portal.*` của SDK. `portal` từ nay được đọc là **billing portal**, bề mặt của
  `apps/billing-portal-ui`.
- `ADMIN_UI_ORIGIN`: env của server API, nói về origin chứ không về tên app.
- Thư mục repo và remote Git.

### Portal thuộc về module

Cổng nhà xe đổi tên thành `billing-portal-ui`, không phải một tên theo nhóm người dùng, vì portal được
sở hữu bởi **module** chứ không bởi đối tượng dùng nó. Một module khác cần bề mặt cho người ngoài thì
dựng portal của riêng mình, cùng một hình dạng:

| Phần           | Billing                                | Module `<m>` về sau                           |
| -------------- | -------------------------------------- | --------------------------------------------- |
| App            | `apps/billing-portal-ui`               | `apps/<m>-portal-ui`                          |
| API surface    | `/v1/portal/**`                        | `/v1/<m>_portal/**`                           |
| SDK            | `portal.*`, `@vxrerp/sdk/react/portal` | `<m>Portal.*`, `@vxrerp/sdk/react/<m>-portal` |
| Link đăng nhập | `billingPortal.sessions.create`        | `<m>Portal.sessions.create`                   |

`/v1/portal` và `portal.*` không mang tiền tố `billing` chỉ vì chúng có trước quy tắc này. Portal thứ
hai **bắt buộc** mang tiền tố module của nó; không portal nào khác được dùng chữ `portal` trần.

Identity của người ngoài thì **không** thuộc về module: nhà xe dùng hai portal vẫn là một tài khoản.
`portal_users` / `portal_memberships` / `portal_sessions` chuyển sang `@vxrerp/platform` khi tách
package, và mỗi portal kiểm tra session đó cộng quyền riêng của module mình. Code UI chung giữa các
portal chỉ tách thành package khi portal thứ hai thật sự xuất hiện.

## Hệ quả

- Môi trường local phải dựng lại compose (`vxrerp-*`), migrate và seed lại, sửa `.env` theo tên mới,
  và đăng nhập lại vì cookie đổi tên. Volume của project compose `pinstripe` cũ không bị xoá.
- Bước tiếp theo là tách `@vxrerp/core` thành `@vxrerp/platform` và `@vxrerp/billing`; tên `billing`
  thay cho pinstripe trong vai trò một module.
