# Admin UI Convention

`apps/admin-ui` là dashboard vận hành: HeroUI v3, đăng nhập thật bằng better-auth, và một ngôn ngữ thị giác lấy từ mockup `vxr-erp-platform`. Không ghi lại chỗ đó thì agent tiếp theo sẽ dựng lại một UI kit tự viết, tự tạo một HTTP client thứ hai để lấy session, hoặc chép màu ERP vào từng class Tailwind — và cả ba đều phá đúng thứ phase 29 vừa dựng.

## Scope

Applies to `apps/admin-ui/**`.

Does **not** apply to:

- `apps/portal-ui` — bề mặt của khách hàng, `portal.*`, luật riêng.
- `packages/sdk/**` — hook, key và toast của SDK do [`sdk-convention.md`](./sdk-convention.md) quản.
- Đường đăng nhập phía server (`/api/v1/auth/*`, authorization) — [`auth-convention.md`](./auth-convention.md).

## UI kit là HeroUI, không có kit thứ hai

Mọi control lấy từ `@heroui/react`. Không dựng lại `src/components/ui/*`, không bọc một `<button className="...">` tự viết khi `Button` đã có.

HeroUI v3 dựng trên react-aria: `Button` nhận `onPress` / `isDisabled` (không phải `onClick` / `disabled`), `TextField` / `Select` nhận `value` / `selectedKey` đã parse sẵn chứ không phải `ChangeEvent`.

```tsx
// CORRECT
<Button variant="ghost" isDisabled={isBusy} onPress={handleOnVoid}>Hủy</Button>

// WRONG — prop của DOM, react-aria bỏ qua onClick
<Button onClick={handleOnVoid} disabled={isBusy}>Hủy</Button>
```

## Token của mockup sống trong `src/index.css`

Biến CSS của HeroUI (`--accent`, `--background`, `--surface`, `--border`, `--radius`, `--danger`…) được override một lần trong `:root` của `src/index.css`, lấy giá trị từ bảng token của mockup trong `docs/ROADMAP-V3.md`. Component đọc chúng qua class của HeroUI / Tailwind (`bg-surface`, `text-accent`, `border-app-border-soft`), **không** viết hex vào class và không import file nào từ repo mockup.

Token riêng của shell — bề rộng sidebar, chiều cao top bar, màu nhãn — khai trong cùng khối `:root` với prefix `--app-*`, rồi xuất qua `@theme inline` để thành utility (`w-sidebar`, `h-topbar`, `text-app-description`).

## Công thức một màn

Một màn đi theo đúng thứ tự này, và mỗi khối là một component dùng chung:

1. `PageCard` — tiêu đề màu primary, phụ đề, slot action, tab tuỳ chọn.
2. `StatGrid` + `StatItem` — bốn ô tổng quan, nhãn uppercase, số lớn.
3. `FilterBar` — đếm "N mục", select, ô tìm.
4. `DataTable` — bảng compact, click cả dòng để mở drawer, empty state, phân trang cursor từ `ListResponse.hasMore`.
5. `EntityDrawer` — tạo và sửa **luôn** trong drawer phải; không có trang form riêng.

`StatusChip` là chỗ duy nhất ánh xạ trạng thái sang màu. Xoá và mọi hành động không đảo được hỏi qua `ConfirmDialog` — không bao giờ `window.confirm`.

Bên trong drawer: `DrawerSection` cho mỗi khối, `DetailList` cho lưới nhãn/giá trị, `DrawerTabs` khi một drawer có nhiều phần. Select đứng ngoài form đi qua `FilterSelect`.

## Tab là route con, drawer là param

Tab của một màn là **route con**, không phải state: `PageTabs` render `NavLink`, và mỗi tab có URL riêng (`/catalog/products`, `/subscriptions/usage`). Mỗi tab là một Page riêng giữ query và mutation của chính nó — đó là thứ giữ [`component-convention.md`](../agentkit/profiles/react/component-convention.md) đúng khi một màn có bốn tab.

Drawer chi tiết của **entity chính** trên màn mở bằng route param (`/customers/:customerId`) để deep-link được; entity phụ trong drawer (tax ID, promotion code, discount) dùng state cục bộ. Một path tĩnh và một path động không bao giờ tranh nhau cùng một đoạn: `/subscriptions` redirect sang `/subscriptions/list`, và id nằm dưới tab của nó.

Phân trang cursor đi qua `src/hooks/useCursorPagination.ts`: `startingAfter` cho query, `advancePage(lastId)` / `revertPage()` cho `DataTable`, `resetPage()` mỗi khi filter đổi. Đừng tự giữ mảng cursor trong page.

## Field đi qua `Controller`

Form dùng react-hook-form theo [`form-convention.md`](../agentkit/profiles/react/form-convention.md); field render qua `src/components/fields/Render{Text,Select,Number,Date,Checkbox}Field`, mỗi cái bọc `Controller` quanh một control HeroUI. Không `form.register` trên control của HeroUI — nó không nhận `ref` + `onChange` kiểu DOM.

`RenderSelectField` quy đổi giá trị rỗng sang một key nội bộ, vì collection của react-aria không nhận `id=""`. Một select ngoài form thì bỏ hẳn option rỗng và dùng `placeholder` của `Select`.

## `better-auth` chỉ ở `src/lib/auth-client.ts`

Đúng một file được import `better-auth*`, và `eslint.config.js` chặn phần còn lại bằng `no-restricted-imports`. File đó dựng `createAuthClient` với `basePath: '/api/v1/auth'` và một `customFetchImpl` bóc envelope lỗi của repo (`{ error: { code, message } }`) thành `{ code, message }` — không có nó thì better-auth-ui đọc `error.code` ra `undefined` và mọi lỗi đăng nhập rơi về một thông báo chung chung.

`@better-auth-ui/heroui` và `@better-auth-ui/react` **không** bị chặn: chúng là UI, không phải HTTP client thứ hai. Không dùng `adminClient()` hay plugin `admin` — quản trị user đi qua SDK `admin.users`.

`AuthProvider` được bọc trong `src/lib/auth.tsx` để lấy `navigate` của react-router; thứ tự provider là `QueryClientProvider` → `AdminPinstripeProvider` → `BrowserRouter` → `AdminAuthProvider`. Sign-up không tồn tại ở server, nên link "Sign up" của `SignIn` bị giấu bằng CSS trên `.auth-view` — đừng gỡ khối đó ra khỏi `index.css`.

## Dữ liệu đi qua hook của SDK

`PinstripeClient` trong `src/lib/pinstripe.tsx` được dựng **không có key**: trình duyệt đi bằng cookie same-origin. `vite.config.ts` chỉ proxy `/api` và `/v1` với `changeOrigin`, không chèn `PINSTRIPE_*_API_KEY` vào header — một bản build ra khỏi `vite dev` phải xác thực được bằng đúng thứ nó có.

Component không gọi thẳng resource: mọi read/write qua hook của `@pinstripe/sdk/react`.

## Quyền ẩn menu, server chặn thật

`src/lib/permissions.ts` cho `usePermissions()` và `useCan(permission)`, cả hai đọc `useAccountQuery`. Sidebar ẩn mục người dùng không có quyền đọc. Đó là ergonomics, **không** phải bảo mật — server vẫn là nơi chặn, theo [`auth-convention.md`](./auth-convention.md).

## Định dạng

Tiền và ngày đi qua `src/lib/format.ts`: `formatCurrency(minorAmount, currency)` chia theo số chữ số thập phân của chính đồng tiền đó, `formatDate(isoDate)` trả `dd/MM/yyyy` theo giờ Việt Nam. Không `toLocaleString` rải rác trong component mới.

## NEVER Do

- Dựng lại một UI kit tự viết trong `src/components/ui/*`, hay bọc tay một control HeroUI đã có.
- Dùng `onClick` / `disabled` trên `Button` của HeroUI — là `onPress` / `isDisabled`.
- Viết hex của mockup vào class Tailwind, hay import file từ repo `vxr-erp-platform`.
- Import `better-auth*` ở bất kỳ file nào ngoài `src/lib/auth-client.ts`, hay dùng `adminClient()` / plugin `admin`.
- Bỏ `customFetchImpl` bóc envelope lỗi ra khỏi auth client.
- Chèn API key vào proxy của `vite.config.ts`, hay đưa key vào `PinstripeClient` của trình duyệt.
- Gọi thẳng resource của SDK từ component — đi qua hook.
- Coi `useCan` là lớp bảo mật.
- Dựng một trang form riêng cho tạo / sửa thay vì drawer, hay xác nhận xoá bằng `window.confirm`.
- Dùng `form.register` trên control của HeroUI thay vì `Render*Field`.
- Giữ tab của một màn bằng state thay vì route con, hay mở drawer của entity chính mà không có route param.
- Tự giữ mảng cursor trong page thay vì `useCursorPagination`.
