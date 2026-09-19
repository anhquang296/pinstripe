# 0025 — Kiến trúc admin-ui: HeroUI, drawer, `useCan`

- **Trạng thái.** Accepted
- **Xây trên.** [0024 — Đăng nhập dashboard và authorization theo session](0024-dashboard-auth-and-session-authorization.md)

## Bối cảnh

Dashboard cũ là 13 trang phẳng, điều hướng bằng một `<select>`, UI kit tự viết trong
`src/components/ui/*`, và một `src/api/` gọi HTTP bằng tay song song với `@pinstripe/sdk`. Một nửa số
hook trong `@pinstripe/sdk/react` không trang nào dùng, và nhiều resource của SDK chưa có hook — nghĩa
là bề mặt công khai của sản phẩm không có ai kiểm chứng bằng cách dùng nó.

V3 dựng lại theo information architecture và ngôn ngữ thị giác của mockup `vxr-erp-platform`.

## Quyết định

### 1. HeroUI v3 là UI kit duy nhất

`@heroui/react` + `@heroui/styles` trên Tailwind v4. `src/components/ui/*` tự viết bị xoá.

HeroUI v3 dựng trên react-aria, nên prop là của react-aria chứ không phải của DOM: `Button` nhận
`onPress` / `isDisabled`, `TextField` / `Select` nhận `value` / `selectedKey` đã parse sẵn chứ không
phải `ChangeEvent`. Đó là thứ hay bị "sửa" ngược về `onClick` / `disabled`, và khi ấy nút im lặng
không làm gì.

Token của mockup override **một lần** trong `:root` của `src/index.css` (`--accent`, `--surface`,
`--border`, `--radius`, `--danger`…); token riêng của shell mang prefix `--app-*` rồi xuất qua
`@theme inline` thành utility (`w-sidebar`, `h-topbar`, `text-app-description`). Component đọc chúng
qua class, không viết hex, và không import file nào từ repo mockup.

> **Cập nhật 2026-09-19:** bỏ override token của mockup. Mockup chỉ còn quyết định layout, tính năng
> và vị trí component; màu, bo góc, viền và font là theme mặc định của HeroUI. `--app-*` chỉ còn kích
> thước shell và `--app-label`; `border-separator` / `text-muted` dùng thẳng. Các khối dùng chung
> (`PageCard`, `StatItem`, `DataTable`, `DrawerSection`, tab) dựng trên `Card` / `Tabs` của HeroUI thay
> vì tự vẽ. Xem `.claude/rules/local/admin-ui-convention.md`.

### 2. Một màn có đúng một công thức

`PageCard` → `StatGrid` + `StatItem` → `FilterBar` → `DataTable` → `EntityDrawer`. `StatusChip` là chỗ
duy nhất ánh xạ trạng thái sang màu; `ConfirmDialog` là chỗ duy nhất hỏi trước một hành động không đảo
được — không bao giờ `window.confirm`.

Công thức cố định là thứ làm cho việc thêm màn thứ hai mươi không phải là một quyết định thiết kế
mới, và làm cho hai màn của hai người viết trông như một.

### 3. Tạo và sửa **luôn** trong drawer phải

Không có trang form riêng. Drawer rộng `min(980px, 100vw - 96px)`, form chia `DrawerSection`, nhiều
phần thì `DrawerTabs` trong header drawer — không stepper.

Lý do là ngữ cảnh: người vận hành sửa một dòng trong bảng cần nhìn thấy bảng phía sau, và quay lại
danh sách không được là một lần điều hướng mất filter đang đặt.

### 4. Tab là route con, drawer là param

Tab của một màn là **route con** (`/catalog/products`, `/subscriptions/usage`), không phải state: mỗi
tab là một Page riêng giữ query và mutation của chính nó. Đó là thứ giữ `component-convention.md` đúng
khi một màn có bốn tab — thay vì một file 800 dòng với bốn nhánh render.

Drawer chi tiết của **entity chính** mở bằng route param (`/customers/:customerId`) để deep-link được;
entity phụ trong drawer dùng state cục bộ. Một path tĩnh và một path động không tranh nhau cùng một
đoạn: `/subscriptions` redirect sang `/subscriptions/list`, và id nằm dưới tab của nó.

Màn không có tab thì không dựng `PageTabs`: `/api-keys`, `/test-clocks`, `/admin/users`,
`/admin/roles` là màn phẳng.

### 5. Không có `api/` folder; dữ liệu đi qua hook của SDK

`apps/admin-ui/src/api/client.ts` bị xoá cùng `Request` / `Endpoint` / `Method` / `Params` /
`Payload` / `Headers`. `PinstripeClient` trong `src/lib/pinstripe.tsx` được dựng **không có key**:
trình duyệt đi bằng cookie same-origin, và `vite.config.ts` chỉ proxy `/api` và `/v1` với
`changeOrigin` — không chèn header nào. Một bản build ra khỏi `vite dev` vì thế xác thực được bằng
đúng thứ nó có.

Component không gọi thẳng resource của SDK; mọi read/write qua hook. Hai test giữ cả hai đầu của sợi
dây: `packages/sdk/src/react/hook-coverage.test.ts` khẳng định mỗi method của resource có ít nhất một
hook gọi tới, và `apps/admin-ui/src/hook-usage.test.ts` khẳng định mỗi hook `…Query` / `…Mutation`
được export xuất hiện trong ít nhất một file của admin-ui, **không có danh sách ngoại lệ**.

Toast vẫn là sonner và vẫn là entry point duy nhất, nhưng SDK không import nó: mutation hook gọi
`onMutationError` / `onMutationSuccess` của provider, và app nối `toast` vào đó một lần trong
`src/lib/pinstripe.tsx`. Chuỗi tiếng Việt ở lại trong app.

### 6. `useCan` ẩn menu, server chặn thật

`src/lib/permissions.ts` cho `usePermissions()` và `useCan(permission)`, cả hai đọc `useAccountQuery`.
Sidebar ẩn mục người dùng không có quyền đọc, và nút ghi ẩn theo cùng cách.

Đó là **ergonomics, không phải bảo mật**. Server vẫn là nơi chặn, theo
[0024](0024-dashboard-auth-and-session-authorization.md) — `useCan` chỉ để người dùng không bấm vào
thứ sẽ trả `403`.

### 7. `better-auth/react` ở đúng một file

`src/lib/auth-client.ts`, và `eslint.config.js` chặn phần còn lại bằng `no-restricted-imports`. File
đó dựng `createAuthClient` với `basePath: '/api/v1/auth'` và một `customFetchImpl` bóc envelope lỗi
của repo thành `{ code, message }` — không có nó thì better-auth-ui đọc `error.code` ra `undefined` và
mọi lỗi đăng nhập rơi về một thông báo chung chung.

`@better-auth-ui/heroui` và `@better-auth-ui/react` không bị chặn: chúng là UI, không phải HTTP client
thứ hai.

## Hệ quả

- **Thêm một màn là thêm một route con và một Page**, không phải một nhánh trong một page có sẵn.
- **Thêm một hook vào SDK mà không có màn dùng tới là một test đỏ.** Bề mặt công khai không phình ra
  được nếu không có người dùng nó.
- **Một secret chỉ trả một lần** — `apiKey.token`, `webhookEndpoint.secret` — sống trong state của
  page đã tạo ra nó, không vào query cache. Đóng drawer là mất; route đọc lại không tồn tại.
- **Bundle lớn.** HeroUI + react-aria + better-auth-ui làm bundle vượt 500 kB sau minify. Chấp nhận:
  đây là công cụ nội bộ sau đăng nhập, không phải trang bán hàng.
- **Sign-up bị giấu bằng CSS.** `SignIn` của better-auth-ui 1.7.26 không có flag tắt link "Sign up";
  route `/sign-up/*` phía server vẫn 404 dù UI làm gì, nhưng khối CSS trên `.auth-view` là thứ giữ
  cho người dùng không bấm vào một trang chết.

## Cân nhắc đã bỏ

- **Giữ `src/components/ui/*` tự viết.** Hai kit song song nghĩa là mọi component mới phải chọn một,
  và lựa chọn đó sẽ không nhất quán.
- **Trang form riêng cho tạo / sửa.** Mất ngữ cảnh bảng, và mất filter đang đặt khi quay lại.
- **Tab bằng state.** Một màn bốn tab thành một component bốn nhánh, và không deep-link được vào tab.
- **Giữ `src/api/` bên cạnh SDK.** Hai HTTP client nghĩa là hai chỗ để auth header và chuẩn hoá lỗi
  sai khác nhau — và SDK là bề mặt công khai của sản phẩm, nên nó phải là thứ dashboard dùng thật.
- **Cho `useCan` quyết định thay server.** Client là nơi người dùng sửa được; mọi luật ở đó là gợi ý.
