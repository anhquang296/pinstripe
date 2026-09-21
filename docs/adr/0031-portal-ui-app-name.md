# 0031 — App của cổng nhà xe là `portal-ui`

- **Trạng thái.** Accepted
- **Sửa một phần.** [0029 — Đổi tên dự án thành vxrerp](0029-rename-to-vxrerp.md): dòng "Cổng nhà xe"
  của bảng đổi tên và dòng "App" của bảng §"Portal thuộc về module". Phần còn lại của 0029 giữ nguyên.

## Bối cảnh

0029 đặt tên app cổng nhà xe là `apps/billing-portal-ui` để nói rằng portal thuộc về module billing.
Nhưng ở mọi lớp khác, billing portal đã mang chữ `portal` trần: route `/v1/portal/**`, resource
`portal.*`, entry `@vxrerp/sdk/react/portal`, subject `VxrErpQuerySubjectEnum.PORTAL`. Tên app là lớp
duy nhất mang tiền tố `billing-`, nên nó lệch với chính bề mặt nó phục vụ và dài hơn mà không phân
biệt thêm được gì.

## Quyết định

App của billing portal là `apps/portal-ui`, package `@vxrerp/portal-ui`. `portal` trần ở mọi lớp — app,
route, SDK — là bề mặt của billing portal.

Quy tắc portal thuộc về module của 0029 không đổi: portal **thứ hai** mang tiền tố module ở mọi lớp,
kể cả app.

| Phần           | Billing                                | Module `<m>` về sau                           |
| -------------- | -------------------------------------- | --------------------------------------------- |
| App            | `apps/portal-ui`                       | `apps/<m>-portal-ui`                          |
| API surface    | `/v1/portal/**`                        | `/v1/<m>_portal/**`                           |
| SDK            | `portal.*`, `@vxrerp/sdk/react/portal` | `<m>Portal.*`, `@vxrerp/sdk/react/<m>-portal` |
| Link đăng nhập | `billingPortal.sessions.create`        | `<m>Portal.sessions.create`                   |

## Hệ quả

- `pnpm --filter @vxrerp/billing-portal-ui …` đổi thành `pnpm --filter @vxrerp/portal-ui …`; config
  preview `billing-portal-ui` trong `.claude/launch.json` đổi thành `portal-ui`.
- `.env.local` của app nằm ở `apps/portal-ui/.env.local`. Máy nào đã có bản cũ thì chuyển nó sang
  thư mục mới.
- ADR 0001–0030 giữ nguyên chữ `billing-portal-ui` vì chúng là lịch sử.
