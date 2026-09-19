# Admin UI Convention

`apps/admin-ui` là dashboard vận hành: HeroUI v3, đăng nhập thật bằng better-auth, layout và tính năng lấy từ mockup `vxr-erp-platform`, còn giao diện là theme mặc định của HeroUI. Không ghi lại chỗ đó thì agent tiếp theo sẽ dựng lại một UI kit tự viết, tự tạo một HTTP client thứ hai để lấy session, hoặc chép lại màu ERP vào theme — và cả ba đều phá đúng thứ phase 29 vừa dựng.

## Scope

Applies to `apps/admin-ui/**`.

Does **not** apply to:

- `apps/portal-ui` — bề mặt của khách hàng, `portal.*`, luật riêng.
- `packages/sdk/**` — hook, key và toast của SDK do [`sdk-convention.md`](./sdk-convention.md) quản.
- Đường đăng nhập phía server (`/api/v1/auth/*`, authorization) — [`auth-convention.md`](./auth-convention.md).

## UI kit là HeroUI, không có kit thứ hai

Mọi control **và mọi surface** lấy từ `@heroui/react`. Không dựng lại `src/components/ui/*`, không bọc một `<button className="...">` tự viết khi `Button` đã có, và không vẽ khung bằng `div` + `border rounded bg-surface` khi `Card` đã có. Khối cần khung là `Card` (ô trong khối là `Card variant="secondary"`), tab là `Tabs variant="secondary"`, thông báo là `Alert`, nhóm lựa chọn là `ToggleButtonGroup`. Component dùng chung trong `src/components` chỉ ghép các mảnh đó theo layout của màn — không tự vẽ lại chúng.

```tsx
// CORRECT
<Card>
  <Card.Header><Card.Description>{label}</Card.Description></Card.Header>
  <Card.Content>{value}</Card.Content>
</Card>

// WRONG — tự vẽ lại Card
<div className="flex flex-col gap-1 rounded-md border bg-surface p-4">…</div>
```

Mọi form trong drawer — tạo lẫn sửa — nằm trong một `DrawerSection`, và form không có khung riêng. Field xếp dọc, mỗi field một dòng, rộng hết form: thẻ `<form>` là `flex flex-col gap-4`, và không truyền class độ rộng cố định (`w-28`, `w-56`…) cho `Render*Field`. `Button` của HeroUI đã `w-fit` nên giữ kích thước tự nhiên.

```tsx
// CORRECT
<EntityDrawer title="Tạo customer" …>
  <DrawerSection title="Thông tin khách hàng">
    <CustomerForm … />
  </DrawerSection>
</EntityDrawer>

// WRONG — form nằm thẳng trong drawer, field xếp ngang
<EntityDrawer title="Tạo customer" …>
  <form className="flex flex-wrap items-end gap-4">…</form>
</EntityDrawer>
```

HeroUI v3 dựng trên react-aria: `Button` nhận `onPress` / `isDisabled` (không phải `onClick` / `disabled`), `TextField` / `Select` nhận `value` / `selectedKey` đã parse sẵn chứ không phải `ChangeEvent`.

```tsx
// CORRECT
<Button variant="ghost" isDisabled={isBusy} onPress={handleOnVoid}>Hủy</Button>

// WRONG — prop của DOM, react-aria bỏ qua onClick
<Button onClick={handleOnVoid} disabled={isBusy}>Hủy</Button>
```

`react-aria`, `react-aria-components`, `@react-aria/*` là peer của `@heroui/react`, và **không** nằm trong `package.json` của admin-ui: `auto-install-peers=true` trong `.npmrc` cài chúng cho HeroUI. `src` không import chúng — `eslint.config.js` chặn bằng `no-restricted-imports`. Một type như `Key` lấy từ `react`. Đừng thêm lại chúng vào `dependencies`, và đừng tắt `auto-install-peers`.

### Bảng đi qua `DataTable`, dựng trên TanStack Table

`src/components/DataTable.tsx` là chỗ duy nhất dùng `Table` của HeroUI. TanStack Table v9 (`useTable`, `tableFeatures`, `createColumnHelper().display`) giữ column def, row model và row id; `Table.*` của HeroUI chỉ render — đúng mẫu TanStack trong tài liệu HeroUI. Không bật sort / pagination của TanStack: phân trang là cursor, qua `useCursorPagination`.

`Table.Cell` **không bao giờ** nhận `id`, chỉ `key={cell.id}`. react-aria dùng `id` làm key trong một `keyMap` chung cho cả bảng, nên cell mang id trùng column ghi đè column và bảng throw `Cell count must match column count. Found N cells and 0 columns.` — chính lỗi làm trắng `/admin/roles` và mọi drawer mở trên list.

```tsx
// CORRECT
<Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>

// WRONG — id trùng column.key, cell đè column trong keyMap
<Table.Cell key={column.key} id={column.key}>{column.renderCell(row)}</Table.Cell>
```

## Mockup quyết định layout, HeroUI quyết định giao diện

Từ mockup chỉ lấy layout, tính năng và vị trí component: shell sidebar + top bar, công thức một màn, drawer bên phải. Màu, bo góc, viền, font và shadow là theme mặc định của HeroUI. `src/index.css` **không** override biến theme của HeroUI (`--accent`, `--background`, `--surface`, `--border`, `--radius`, `--field-*`, `--font-sans`…) — override một biến là kéo một field, một popover ra khỏi phần còn lại của kit, và dark mode của HeroUI mất theo.

```css
/* CORRECT — kích thước shell; màu phụ, nếu HeroUI chưa có, dẫn xuất từ token của nó */
--app-sidebar-width: 248px;
--app-label: color-mix(in oklab, var(--foreground) 70%, transparent);

/* WRONG — chép token của mockup đè lên theme */
--accent: #006ad9;
--field-radius: 0.375rem;
```

Token riêng của shell khai trong `:root` với prefix `--app-*` rồi xuất qua `@theme inline` để thành utility (`w-sidebar`, `h-topbar`, `text-app-label`). Kích thước là giá trị thật; màu thì chỉ dẫn xuất từ biến của HeroUI, không viết hex. Không đặt alias cho một màu HeroUI đã có tên — dùng thẳng `border-separator`, `text-muted`, `bg-surface`, `text-accent`. Không viết hex vào class và không import file nào từ repo mockup.

Scrollbar style **một lần, toàn cục** trong `src/index.css` qua `--app-scrollbar-*` (thumb pill dẫn xuất từ `--foreground` — nhạt khi nghỉ, đậm khi hover — không track, không nút mũi tên). Không style scrollbar riêng trong component. `scrollbar-width` / `scrollbar-color` nằm trong `@supports not selector(::-webkit-scrollbar)` và phải ở yên đó: Chrome ≥121 thấy hai thuộc tính đó là bỏ toàn bộ `::-webkit-scrollbar`, và thumb pill mất.

## Công thức một màn

Một màn đi theo đúng thứ tự này, và mỗi khối là một component dùng chung:

1. `PageCard` — tab (nếu có) ở đầu trang, **phía trên** `Card` tiêu đề; `Card` chứa tiêu đề, phụ đề, slot action; nội dung màn nằm dưới nó. Tab không nằm trong `Card`.
2. `StatGrid` + `StatItem` — bốn `Card` tổng quan, nhãn uppercase, số lớn.
3. `FilterBar` — đếm "N mục", select, ô tìm; truyền vào `DataTable` qua prop `toolbar`.
4. `DataTable` — `Table` variant mặc định (`primary`) **chính là** khung: nền xám bọc toolbar, thân bảng trắng và `Table.Footer`. Root mang `shadow-surface` — cùng shadow với `Card` — để bảng nổi khối giống `DrawerSection`. Không bọc nó trong `Card` hay `div` có viền, và không override CSS của `.table-*`. Phân trang cursor từ `ListResponse.hasMore` qua `Pagination` của HeroUI đặt trong `Table.Footer` (chỉ Summary + Previous/Next — cursor không có tổng số trang); click cả dòng để mở drawer. Page không bọc thêm khung quanh nó.
5. `EntityDrawer` — tạo và sửa **luôn** trong drawer phải; không có trang form riêng. Drawer rộng một phần ba màn hình cộng 200px (`calc(max(33vw, 28rem) + 200px)`). Độ rộng đặt trên `Drawer.Dialog`, không bao giờ trên `Drawer.Content` — `Content` là lớp định vị phủ cả màn, đặt width lên nó là drawer lệch vào giữa.

`StatusChip` là chỗ duy nhất ánh xạ trạng thái sang màu. Xoá và mọi hành động không đảo được hỏi qua `ConfirmDialog` — không bao giờ `window.confirm`.

Bên trong drawer: `DrawerSection` cho mỗi khối, `DetailList` cho lưới nhãn/giá trị, `DrawerTabs` khi một drawer có nhiều phần. Select đứng ngoài form đi qua `FilterSelect`.

Một secret chỉ server trả **một lần** — `apiKey.token`, `webhookEndpoint.secret` — không bao giờ đi vào query cache để đọc lại: nó sống trong state của chính page đã tạo ra nó, hiện kèm nút sao chép, và bị xoá khi drawer đóng. Đừng thêm một hook đọc lại nó; route không có.

Hai bề mặt của nhóm Admin không có nút xoá, vì không có route xoá: user hạ quyền hay vô hiệu hoá qua `useUpdateUserMutation`, và `/admin/roles` chỉ đọc vì `ROLE_PERMISSIONS` là hằng số trong `@pinstripe/core`. Lỗi "admin active cuối cùng" đến từ server và hiện qua toast của provider — đừng đoán trước luật đó ở client.

## Tab là route con, drawer là param

Tab của một màn là **route con**, không phải state: `PageTabs` render `Tabs` của HeroUI (variant mặc định, `w-fit`) với `selectedKey` suy ra từ `pathname` và `navigate(to)` khi đổi tab, và mỗi tab có URL riêng (`/catalog/products`, `/subscriptions/usage`). Mỗi tab là một Page riêng giữ query và mutation của chính nó — đó là thứ giữ [`component-convention.md`](../agentkit/profiles/react/component-convention.md) đúng khi một màn có bốn tab.

Drawer chi tiết của **entity chính** trên màn mở bằng route param (`/customers/:customerId`) để deep-link được; entity phụ trong drawer (tax ID, promotion code, discount) dùng state cục bộ. Một path tĩnh và một path động không bao giờ tranh nhau cùng một đoạn: `/subscriptions` redirect sang `/subscriptions/list`, và id nằm dưới tab của nó.

Một màn **không** có tab thì không dựng `PageTabs` cho nó: `/api-keys`, `/test-clocks`, `/admin/users`, `/admin/roles` là màn phẳng, id nằm ngay dưới path của màn (`/test-clocks/:testClockId`, `/admin/users/:userId`).

Phân trang cursor đi qua `src/hooks/useCursorPagination.ts`: `startingAfter` cho query, `advancePage(lastId)` / `revertPage()` cho `DataTable`, `resetPage()` mỗi khi filter đổi. Đừng tự giữ mảng cursor trong page.

## Field đi qua `Controller`

Form dùng react-hook-form theo [`form-convention.md`](../agentkit/profiles/react/form-convention.md); field render qua `src/components/fields/Render{Text,Select,Number,Date,Checkbox,CheckboxGroup}Field`, mỗi cái bọc `Controller` quanh một control HeroUI. Không `form.register` trên control của HeroUI — nó không nhận `ref` + `onChange` kiểu DOM.

`RenderCheckboxGroupField` là field của một **mảng giá trị đóng** — `enabledEvents` của webhook endpoint, `scopes` của API key. Một tập nhiều lựa chọn không đi qua `Select`: HeroUI v3 `Select` là single-select, và ghép nhiều `RenderCheckboxField` boolean thì form data không còn là mảng mà payload cần.

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
- Vẽ khung bằng `div` + `border rounded bg-surface` thay vì `Card`, hay tự làm tab bằng `<button>` thay vì `Tabs`.
- Đặt độ rộng hay nền lên `Drawer.Content` — chúng thuộc về `Drawer.Dialog`.
- Đặt alias `--app-*` cho một màu HeroUI đã có tên.
- Dùng `onClick` / `disabled` trên `Button` của HeroUI — là `onPress` / `isDisabled`.
- Import `react-aria*`, `@react-aria/*` hay `@react-stately/*` trong `src`, hay thêm chúng lại vào `package.json` — chúng là peer của HeroUI, pnpm tự cài.
- Dựng bảng bằng `Table` của HeroUI ngoài `DataTable`, hay đặt `id` trên `Table.Cell`.
- Override biến theme của HeroUI trong `src/index.css`, hay viết hex vào class Tailwind hoặc vào `--app-*`.
- Import file từ repo `vxr-erp-platform`.
- Import `better-auth*` ở bất kỳ file nào ngoài `src/lib/auth-client.ts`, hay dùng `adminClient()` / plugin `admin`.
- Bỏ `customFetchImpl` bóc envelope lỗi ra khỏi auth client.
- Chèn API key vào proxy của `vite.config.ts`, hay đưa key vào `PinstripeClient` của trình duyệt.
- Gọi thẳng resource của SDK từ component — đi qua hook.
- Coi `useCan` là lớp bảo mật.
- Dựng một trang form riêng cho tạo / sửa thay vì drawer, hay xác nhận xoá bằng `window.confirm`.
- Dùng `form.register` trên control của HeroUI thay vì `Render*Field`.
- Giữ tab của một màn bằng state thay vì route con, hay mở drawer của entity chính mà không có route param.
- Tự giữ mảng cursor trong page thay vì `useCursorPagination`.
- Ghép nhiều checkbox boolean cho một field mảng thay vì `RenderCheckboxGroupField`.
- Đưa một secret chỉ trả một lần vào query cache, hay thêm hook đọc lại nó.
- Thêm nút xoá user, hay cho `/admin/roles` sửa được `ROLE_PERMISSIONS`.
- Dựng `PageTabs` cho một màn chỉ có một bề mặt.
